import React, { createContext, useContext, useEffect, useRef, useState } from "react";

const CLIENT_ID =
  "11378224123-ekgt0i298mqcsuesqfaubdbgskbjvk6a.apps.googleusercontent.com";

const SCOPES = [
  "https://www.googleapis.com/auth/drive.file",
  "https://www.googleapis.com/auth/spreadsheets",
].join(" ");

const GoogleAuthContext = createContext(null);

export function GoogleAuthProvider({ children }) {
  const tokenClientRef = useRef(null);
  const [gtoken, setgtoken] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // Initialize Google Identity Services
  useEffect(() => {
    function initGis() {
      if (!window.google?.accounts?.oauth2) return;
      tokenClientRef.current = window.google.accounts.oauth2.initTokenClient({
        client_id: CLIENT_ID,
        scope: SCOPES,
        callback: (resp) => {
          if (resp?.access_token) {
            setgtoken(resp.access_token);
            setStatus("Signed in");
          } else {
            setError("gtoken response missing access_token");
          }
        },
      });
    }

    let tries = 0;
    const t = setInterval(() => {
      tries++;
      if (window.google?.accounts?.oauth2) {
        clearInterval(t);
        initGis();
      }
      if (tries > 100) clearInterval(t);
    }, 50);

    return () => clearInterval(t);
  }, []);

  const signIn = () => {
    if (!tokenClientRef.current) {
      setError("Google Identity Services not ready.");
      return;
    }
    tokenClientRef.current.requestAccessToken({
      prompt: gtoken ? "" : "consent",
    });
  };

  return (
    <GoogleAuthContext.Provider value={{ gtoken, signIn, status, error }}>
      {children}
    </GoogleAuthContext.Provider>
  );
}

export function useGoogleAuth() {
  return useContext(GoogleAuthContext);
}
