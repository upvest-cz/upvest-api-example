import React, { useEffect, useState } from 'react';
import { Decimal } from 'decimal.js-light';
import * as R from 'ramda';
import { useAuth0 } from '@auth0/auth0-react';
import cookie from 'js-cookie';
import { gql, GraphQLClient } from 'graphql-request';
import { computeExpectedYield, CURRENCIES, INVESTMENT_STATES, sumPayments } from './scripts/utils.js';
import axios from 'axios';

const KB_DISTRIBUTION_ID_CONSTANT = 3;

const query = gql`
query {
  myAccount {
    id
    variable_symbol
    distribution_partner_account {
      distribution_partner_id
    }
  }
  myInvestments {
    ...MyInvestmentFields
  }
  myOpportunities {
    id
    text_id
    title
    interest_rate
    fundraising_period_start
    fundraising_period_end
    maturity
    expected_maturity
    payment_frequency
    status
    created_at
    interest_rate_type
    investments: myInvestments {
      ...MyInvestmentFields
    }
    payments: myPayments {
      ...MyPaymentFields
    }
  }
}

fragment MyPaymentFields on Payment {
  id
  investment {
    id
  }
  account {
    id
  }
  amount
  amount_interest
  amount_principal
  created_at
  currency
}

fragment MyInvestmentFields on Investment {
  id
  account_id
  opportunity_id
  amount
  created_at
  updated_at
  currency
  state
  interest_rate
  interest_period_start
  fees_agreement
  interest_period_start
}
`;


function App() {
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    getAccessTokenSilently,
    getIdTokenClaims,
  } = useAuth0();
  const [data, setData] = useState({});
  const [account, setAccount] = useState({});

  const [client] = useState(new GraphQLClient(`${process.env.REACT_APP_UPVEST_BASE_URL}/graphql`, {
    credentials: 'include',
    mode: 'cors',
  }));

  useEffect(() => {
    async function run() {
      if (isAuthenticated) {
        const accessToken = await getAccessTokenSilently({
          audience: `https://${process.env.REACT_APP_AUTH0_DOMAIN}/api/v2/`,
          scope: 'openid profile email',
        });

        const idToken = await getIdTokenClaims();

        cookie.set('access_token', accessToken);
        cookie.set('id_token', idToken.__raw);

        const [account, data] = await Promise.all([
          axios.get(
            `${process.env.REACT_APP_UPVEST_BASE_URL}/api/accounts/${idToken.sub}`,
            {
              withCredentials: true,
              headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
              },
            }
          ).then(({ data }) => data),
          client.request(query)
        ]);

        setData(data);
        setAccount(account);
      }
    }

    run();
  }, [client, getAccessTokenSilently, getIdTokenClaims, isAuthenticated]);

  const { myOpportunities = [], myInvestments = [], myAccount = {} } = data;

  const allOpportunitiesPayments = R.mapObjIndexed(
    decimalInstance => decimalInstance.toNumber(),
    myOpportunities.reduce(
      (sum, opportunity) => {
        const { amount, amount_interest, amount_principal } = sumPayments(opportunity);
        return {
          amount: sum.amount.plus(amount),
          amount_interest: sum.amount_interest.plus(amount_interest),
          amount_principal: sum.amount_principal.plus(amount_principal),
        };
      },
      {
        amount: new Decimal(0),
        amount_interest: new Decimal(0),
        amount_principal: new Decimal(0),
      },
    ),
  );

  const allOpportunitiesExpectedYield = myOpportunities
    .reduce(
      (totalYield, opportunity) => totalYield.plus(computeExpectedYield(opportunity)),
      new Decimal(0),
    )
    .toNumber();

  const investment_amount = myInvestments
    .filter(({ currency, state }) => currency === CURRENCIES.CZK && state !== INVESTMENT_STATES.DISCARDED)
    .reduce(
      (totalInvested, investment) => totalInvested.plus(investment.amount),
      new Decimal(0),
    )
    .toNumber();

  const statsData = {
    total_invested: investment_amount,
    paid_off: allOpportunitiesPayments.amount_principal,
    net_yield: allOpportunitiesPayments.amount_interest,
    currently_invested: investment_amount - allOpportunitiesPayments.amount_principal,
    expected_yield: allOpportunitiesExpectedYield,
  };


  return (
    <div className="App">
      {isAuthenticated ? (
        <div>
          <div>
            <button type="button" onClick={logout}>
              Log out
            </button>
          </div>
          <div>
            <h2>{user.name}</h2>
            <p>{user.email}</p>
          </div>
          <div>
            <h2>Account</h2>
            <ul>
              <li>Is KB account: {myAccount?.distribution_partner_account?.distribution_partner_id === KB_DISTRIBUTION_ID_CONSTANT ? 'YES' : 'NO'}</li>
              <li>Account variable symbol: {myAccount?.variable_symbol}</li>
              <li>Account balance: {account?.balance}</li>
              <li>Account pending withdrawals: {account?.pending_withdrawal_amount}</li>
            </ul>
            <h2>Investments</h2>
            <ul>
              <li>Total invested: {statsData.total_invested}</li>
              <li>Paid off amount: {statsData.paid_off}</li>
              <li>Currently invested: {statsData.currently_invested}</li>
              <li>Expected yield: {statsData.expected_yield}</li>
              <li>Paid out yield: {statsData.net_yield}</li>
            </ul>
          </div>
        </div>
      ) : (
        <div>
          <button type="button" onClick={loginWithRedirect}>
            Log in
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
