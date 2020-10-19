import { Request, Response } from 'express';
import moment from 'moment';

import {
  getListTableDashboard,
  getSummaryDashboard,
  getTransactions,
  getBlocks,
  getTokens,
  getTransactionDetail,
  getBlockDetail,
  getTokenDetail,
  getAddressDetail,
} from '../services/dashboard.service';

export const index = async (req: Request, res: Response) => {
  res.redirect('/dashboard');
};

export const dashboard = async (req: Request, res: Response) => {
  try {
    const listTableDashboard = await getListTableDashboard();
    const summaryDashboardData = await getSummaryDashboard();
    let { transactions = [], blocks = [] } = listTableDashboard;
    const {
      totalTransactions = 0,
      totalBlocks = 0,
      latestBlock = 0,
      totalTokens = 0,
      latestCheckPoint = 0,
      totalStores = 0,
      totalBalances = 0,
    } = summaryDashboardData;

    transactions = transactions.map((item) => {
      return {
        ...item,
        createdAt: moment(item.createdAt).fromNow(),
      };
    });
    blocks = blocks.map((item) => {
      return {
        ...item,
        createdAt: moment(item.createdAt).fromNow(),
      };
    });

    res.render('pages/dashboard', {
      title: 'The BURN Blockchain Explorer',
      transactions,
      blocks,
      totalTransactions,
      totalBlocks,
      latestBlock,
      totalTokens,
      latestCheckPoint,
      totalStores,
      totalBalances,
    });
  } catch (error) {
    res.render('pages/dashboard', {
      title: 'The BURN Blockchain Explorer',
      transactions: [],
      blocks: [],
      totalTransactions: 0,
      totalBlocks: 0,
    });
  }
};

export const transactions = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const offset = (+page - 1) * +limit;
    const dataRes = await getTransactions(+offset, +limit);
    let { transactions = [] } = dataRes;
    const { total = 0 } = dataRes;
    const { pages, totalPage } = pagination(+page, total, +limit);
    transactions = transactions.map((item) => {
      return {
        ...item,
        createdAt: moment(item.createdAt).fromNow(),
      };
    });
    res.render('pages/transactions', {
      transactions,
      pages,
      currentPage: +page,
      totalPage,
    });
  } catch (error) {
    res.render('pages/transactions', {
      transactions: [],
      pages: [],
      totalPage: 0,
    });
  }
};

export const blocks = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const offset = (+page - 1) * +limit;
    const dataRes = await getBlocks(offset, +limit);
    let { blocks = [] } = dataRes;
    const { total = 0 } = dataRes;
    const { pages, totalPage } = pagination(+page, total, +limit);
    blocks = blocks.map((item) => {
      return {
        ...item,
        createdAt: moment(item.createdAt).fromNow(),
      };
    });
    res.render('pages/blocks', {
      blocks,
      pages,
      currentPage: +page,
      totalPage,
    });
  } catch (error) {
    res.render('pages/blocks', {
      blocks: [],
      pages: [],
      totalPage: 0,
    });
  }
};

export const tokens = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 15 } = req.query;
    const offset = (+page - 1) * +limit;
    const dataRes = await getTokens(offset, +limit);
    let { tokens = [] } = dataRes;
    const { total = 0 } = dataRes;
    const { pages, totalPage } = pagination(+page, total, +limit);
    tokens = tokens.map((ele) => {
      return {
        ...ele,
        totalSupply: ele.totalSupply.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
        holders: ele.holders.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
        transfers: ele.transfers.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
      };
    });
    res.render('pages/tokens', {
      tokens,
      total,
      pages,
      currentPage: +page,
      totalPage,
    });
  } catch (error) {
    res.render('pages/tokens', {
      tokens: [],
      pages: [],
      totalPage: 0,
    });
  }
};

export const getTransaction = async (req: Request, res: Response) => {
  try {
    const key = req.params.id;
    if (!/^0x[a-fA-F0-9]+$/.test(`${key}`)) {
      throw new Error('url invalid!');
    }
    const { transactionData } = await getTransactionDetail(key);
    res.render('page-detail/transaction', {
      title: 'Transaction',
      transactionData,
    });
  } catch (error) {
    res.render('page-detail/transaction', {
      title: 'Transaction',
      transactionData: null,
    });
  }
};

export const getBlock = async (req: Request, res: Response) => {
  try {
    const key = req.params.id;
    if (!/^[+,-]?\d+$/.test(`${key}`)) {
      throw new Error('url invalid!');
    }
    const { blockData, preBlockNumber, nextBlockNumber } = await getBlockDetail(Number(key));
    res.render('page-detail/block', {
      title: 'Blocks',
      code: blockData.blockNumber,
      url: process.env.ETHERSCAN_URL,
      preBlockNumber,
      nextBlockNumber,
      blockData,
    });
  } catch (error) {
    res.render('page-detail/block', {
      title: 'Blocks',
      code: req.params.id,
      preBlockNumber: null,
      nextBlockNumber: null,
      blockData: null,
    });
  }
};

export const getToken = async (req: Request, res: Response) => {
  try {
    const key = req.params.id;
    const { token } = await getTokenDetail(key);
    Object.assign(token, {
      totalSupply: token.totalSupply.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
      holders: token.holders.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
      transfers: token.transfers.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
    });
    res.render('page-detail/token', {
      title: 'Token',
      token,
      url: process.env.BURN_API_URL,
    });
  } catch (error) {
    res.render('pages/error', {
      error,
    });
  }
};

export const getAddress = async (req: Request, res: Response) => {
  try {
    const key = req.params.id;
    const dataRes = await getAddressDetail(key);
    const { tokens: dataTokens = [], total: totalTokens = 0 } = await getTokens(0, 10);
    const tokens = dataTokens.map((ele) => {
      return {
        ...ele,
        totalSupply: ele.totalSupply.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
        holders: ele.holders.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
        transfers: ele.transfers.toString().replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1,'),
      };
    });
    let { transactions = [] } = dataRes;
    const { total = 0, balances: addressDetail } = dataRes;
    transactions = transactions.map((item) => {
      return {
        ...item,
        createdAt: moment(item.createdAt).fromNow(),
      };
    });

    res.render('page-detail/address', {
      title: 'Address',
      tokens,
      totalTokens,
      total,
      transactions,
      addressDetail,
      address: key,
      url: process.env.BURN_API_URL,
    });
  } catch (error) {
    res.render('pages/error', {
      error,
    });
  }
};

const pagination = (page: number, total: number, totalPerPage: number, totalPageShow = 3) => {
  const totalPage = Math.ceil(total / totalPerPage);
  const totalShow = Math.min(page > totalPage ? 0 : totalPage, totalPageShow);
  const start = Math.min(Math.max(1, page - (totalShow >> 1)), totalPage - totalShow + 1);
  const pages = Array.from({ length: totalShow }, (i, index) => index + start);
  return { pages, totalPage };
};
