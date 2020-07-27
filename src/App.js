import React, { useEffect, useState } from "react";
import { useAuth0 } from "@auth0/auth0-react";
import axios from "axios";
import cookie from "js-cookie";

function App() {
  const {
    loginWithRedirect,
    logout,
    user,
    isAuthenticated,
    getAccessTokenSilently,
    getIdTokenClaims,
  } = useAuth0();
  const [data, setData] = useState();

  useEffect(() => {
    async function run() {
      if (isAuthenticated) {
        const accessToken = await getAccessTokenSilently({
          audience: `https://upvest.eu.auth0.com/api/v2/`,
          scope: "read:current_user",
        });

        const idToken = await getIdTokenClaims();

        cookie.set("access_token", accessToken);
        cookie.set("id_token", idToken.__raw);

        const { data } = await axios.get(
          "http://localhost:3001/api/opportunities/my",
          {
            withCredentials: true,
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
            },
          }
        );

        setData(data);
      }
    }

    run();
  }, [getAccessTokenSilently, getIdTokenClaims, isAuthenticated]);

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
            <pre>{JSON.stringify(data, null, 2)}</pre>
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
