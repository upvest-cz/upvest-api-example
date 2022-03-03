import { Decimal } from 'decimal.js-light';
import * as R from 'ramda';

export const CURRENCIES = {
  CZK: 'CZK',
  EUR: 'EUR',
};

export const OPPORTUNITY_INTEREST_RATE_TYPE = {
  SIMPLE: 'simple',
  COMPOUND: 'compound',
};

export const INVESTMENT_STATES = {
  RUNNING: 'running',
  YIELDING: 'yielding',
  PAID_OFF: 'paid_off',
  DISCARDED: 'discarded',
};

/*
This function is inaccurate in some instances, we don't use it interally.
It's for demonstration purposes only.
 */
export function diffInYears(startDate, endDate) {
  const ageDifMs = new Date(endDate) - new Date(startDate);
  const ageDate = new Date(ageDifMs); // miliseconds from epoch
  return Math.abs(ageDate.getUTCFullYear() - 1970);
}

export const computeInvestmentExpectedYield = (investment, opportunity) => {
  if (investment.state !== INVESTMENT_STATES.RUNNING &&
    investment.state !== INVESTMENT_STATES.YIELDING)
    return 0;
  const { maturity } = opportunity;
  const { created_at, amount, interest_rate, interest_period_start } = investment;
  const safeAmount = new Decimal(amount);
  const safeInterestRate = new Decimal(interest_rate);
  const durationInYears = diffInYears(interest_period_start || created_at, maturity);
  const totalYield = opportunity.interest_rate_type === OPPORTUNITY_INTEREST_RATE_TYPE.SIMPLE
    ? // simple interest
    safeAmount
      .times(safeInterestRate.dividedBy(100).times(durationInYears).plus(1))
      .minus(amount)
    : // compound interest
    safeAmount
      .times(safeInterestRate.dividedBy(100).plus(1).pow(durationInYears))
      .minus(amount);
  const paidOffYield = opportunity.payments
    .filter(payment => investment.id === payment.investment.id)
    .reduce((investmentPaidOffYield, payment) => investmentPaidOffYield.plus(payment.amount_interest), new Decimal(0));
  return totalYield.minus(paidOffYield).toNumber();
};
export const computeExpectedYield = (opportunity, currency = CURRENCIES.CZK) => {
  const activeInvestments = opportunity.investments.filter(investment => (investment.state === INVESTMENT_STATES.RUNNING ||
      investment.state === INVESTMENT_STATES.YIELDING) &&
    investment.currency === currency);
  return activeInvestments
    .reduce((opportunityTotalYield, investment) => opportunityTotalYield.plus(computeInvestmentExpectedYield(investment, opportunity)), new Decimal(0))
    .toNumber();
};
export const sumPayments = (opportunity, currency = CURRENCIES.CZK) => {
  const returnVal = opportunity.payments
    .filter(payment => payment.currency === currency)
    .reduce((sum, payment) => ({
      amount: sum.amount.plus(payment.amount),
      amount_interest: sum.amount_interest.plus(payment.amount_interest),
      amount_principal: sum.amount_principal.plus(payment.amount_principal),
    }), {
      amount: new Decimal(0),
      amount_interest: new Decimal(0),
      amount_principal: new Decimal(0),
    });
  return R.mapObjIndexed(decimalInstance => decimalInstance.toNumber(), returnVal);
};
