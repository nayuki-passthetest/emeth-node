import axios from 'axios';
import AxiosMockAdapter from 'axios-mock-adapter';
import * as crypto from 'crypto';
import { BigNumber, Contract, Wallet, constants, ethers } from 'ethers';
import * as fs from 'fs';
import * as path from 'path';

import walletMiddleware from '../../middlewares/wallet';
import contractsMiddleware from '../../middlewares/contracts';
import worker from '../worker';

// eslint-disable-next-line @typescript-eslint/no-var-requires
const solc = require('solc');

const provider = new ethers.providers.WebSocketProvider('ws://ethereum:8546');

let wallet: Wallet;
let emethCoreContract: Contract, emethTokenContract: Contract;

beforeAll(async () => {
  const networkOwner = provider.getUncheckedSigner();
  const deployerWallet = ethers.Wallet.createRandom().connect(provider);

  wallet = ethers.Wallet.createRandom().connect(provider);

  await Promise.all([
    (
      await networkOwner.sendTransaction({
        to: deployerWallet.address,
        value: BigNumber.from('1000000000000000000'),
      })
    ).wait(),
    (
      await networkOwner.sendTransaction({
        to: wallet.address,
        value: BigNumber.from('1000000000000000000'),
      })
    ).wait(),
  ]);

  const output = JSON.parse(
    solc.compile(
      JSON.stringify({
        language: 'Solidity',
        sources: {
          'EmethToken.sol': {
            content: fs.readFileSync(
              path.join(__dirname, '/../../contracts/EmethToken.sol'),
              'utf8',
            ),
          },
          'EmethCore.sol': {
            content: fs.readFileSync(
              path.join(__dirname, '/../../contracts/EmethCore.sol'),
              'utf8',
            ),
          },
        },
        settings: {
          evmVersion: 'paris',
          optimizer: {
            enabled: true,
          },
          outputSelection: {
            '*': {
              '*': ['*'],
            },
          },
        },
      }),
    ),
  );

  emethTokenContract = await new ethers.ContractFactory(
    output.contracts['EmethToken.sol'].EmethToken.abi,
    '0x' + output.contracts['EmethToken.sol'].EmethToken.evm.bytecode.object,
    deployerWallet,
  ).deploy();

  emethCoreContract = await new ethers.ContractFactory(
    output.contracts['EmethCore.sol'].EmethCore.abi,
    '0x' + output.contracts['EmethCore.sol'].EmethCore.evm.bytecode.object,
    deployerWallet,
  ).deploy(emethTokenContract.address);

  await (
    await emethTokenContract.transfer(wallet.address, BigNumber.from('1000000000000000000'))
  ).wait();
}, 30000);

const axiosMock = new AxiosMockAdapter(axios);

afterAll(() => {
  provider._websocket.close();
});

afterEach(() => {
  axiosMock.reset();
});

test('Worker', async () => {
  await (await emethTokenContract.approve(emethCoreContract.address, constants.MaxUint256)).wait();

  const jobId = '0x' + crypto.randomBytes(16).toString('hex');

  await (
    await emethCoreContract.request(
      jobId,
      999,
      '0x00000000000000000000000000000000',
      1,
      1,
      'test-dataset-programid-999.zip',
      JSON.stringify({ param1: Math.random(), param2: Math.random(), param3: Math.random() }),
      20000,
      1000000000,
      Math.floor(new Date().getTime() / 1000) + 60,
    )
  ).wait();

  axiosMock.onGet('https://emeth-cache.testnet.alt.ai/api/v1/jobs?status=1').replyOnce(200, [
    {
      id: jobId,
      parentId: '0x00000000000000000000000000000000',
      programId: 999,
      param: '{"param1":0.5498437231321065,"param2":0.974225145828256,"param3":0.8518194778383965}',
      numParallel: 1,
      numEpoch: 1,
      dataset: 'dataset-sample-0x2511c4f21e9f45b89a9e9164a3b4b4e7',
      deadline: 1690668493,
      fuelLimit: '20000',
      fuelPrice: '1000000000',
      fuelUsed: '0',
      result: null,
      requester: '0x408E40781B760f8f9d51CE9DCF980DCF4be4FEe9',
      assignedNode: null,
      status: 1,
      created: '2023-06-29T22:08:22.000Z',
      updated: '2023-06-29T22:08:22.000Z',
    },
  ]);

  axiosMock.onGet('https://emeth-cache.testnet.alt.ai/api/v1/jobs?status=1').reply(200, []);

  const args = {
    _: [],
    $0: 'worker',
    cacheServerUrl: 'https://emeth-cache.testnet.alt.ai/api/v1/jobs',
    emethCoreContractAddress: emethCoreContract.address,
    emethTokenContractAddress: emethTokenContract.address,
    endpoint: 'ws://ethereum:8546/',
    interval: 10000,
    iterations: 1,
    privateKey: wallet.privateKey,
    logger: console,
  } as any;

  await walletMiddleware(args);
  await contractsMiddleware(args);

  await worker.handler(args);

  args.wallet.provider._websocket.close();
}, 60000);
