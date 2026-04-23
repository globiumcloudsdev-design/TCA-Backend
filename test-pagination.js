import * as m from './src/models/postgres/index.js';
import { getFeeVouchers } from './src/services/feeVoucher.service.js';

async function test() {
  await m.default.sequelize.sync();
  const res = await getFeeVouchers('a91d1ea3-9ed1-4dca-97cc-b962776c5b61', { month: 4 }, { page: 1, limit: 25 });
  console.log('Result length:', res.vouchers.length);
  console.log('Pagination:', res.pagination);
  process.exit(0);
}
test().catch(console.error);
