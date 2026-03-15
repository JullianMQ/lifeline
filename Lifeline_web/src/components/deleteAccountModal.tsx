import { useEffect, useState } from "react";
import type { FormEvent, MouseEvent } from "react";
import { API_BASE_URL } from "../config/api";
import { authClient } from "../scripts/auth-client";

type DeleteAccountModalProps = {
  open: boolean;
  onClose: () => void;
};

type DeleteStage = "warning" | "confirm" | "success";

type DeleteMethod = "password" | "recent-session";

type LinkedAccount = {
  providerId: string;
};

type DeleteEvent = FormEvent<HTMLFormElement> | MouseEvent<HTMLButtonElement>;

const WARNING_COUNTDOWN = 3;
const SUCCESS_COUNTDOWN = 3;

function formatProviderName(providerId: string | null) {
  if (!providerId) {
    return "social";
  }

  if (providerId === "google") {
    return "Google";
  }

  return providerId.charAt(0).toUpperCase() + providerId.slice(1);
}

export default function DeleteAccountModal({
  open,
  onClose,
}: DeleteAccountModalProps) {
  const [stage, setStage] = useState<DeleteStage>("warning");
  const [warningCountdown, setWarningCountdown] = useState(WARNING_COUNTDOWN);
  const [successCountdown, setSuccessCountdown] = useState(SUCCESS_COUNTDOWN);
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isLoadingDeleteMethod, setIsLoadingDeleteMethod] = useState(false);
  const [deleteMethod, setDeleteMethod] = useState<DeleteMethod>("password");
  const [socialProvider, setSocialProvider] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      setStage("warning");
      setWarningCountdown(WARNING_COUNTDOWN);
      setSuccessCountdown(SUCCESS_COUNTDOWN);
      setPassword("");
      setError(null);
      setIsDeleting(false);
      setIsLoadingDeleteMethod(false);
      setDeleteMethod("password");
      setSocialProvider(null);
      return;
    }

    let isCancelled = false;

    const loadDeleteMethod = async () => {
      setIsLoadingDeleteMethod(true);

      try {
        const response = await fetch(`${API_BASE_URL}/api/auth/list-accounts`, {
          credentials: "include",
        });
        
        if (!response.ok) {
          throw new Error(`Failed to load accounts: ${response.status}`);
        }

        const accounts = (await response.json()) as LinkedAccount[];
        const hasCredentialAccount = accounts.some(
          (account) => account.providerId === "credential"
        );
        const detectedSocialProvider =
          accounts.find((account) => account.providerId !== "credential")
            ?.providerId ?? null;

        if (isCancelled) {
          return;
        }

        setDeleteMethod(hasCredentialAccount ? "password" : "recent-session");
        setSocialProvider(detectedSocialProvider);
      } catch (err) {
        console.error("Failed to detect delete method:", err);

        if (isCancelled) {
          return;
        }

        setDeleteMethod("password");
        setSocialProvider(null);
      } finally {
        if (!isCancelled) {
          setIsLoadingDeleteMethod(false);
        }
      }
    };

    void loadDeleteMethod();

    return () => {
      isCancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open || stage !== "warning" || warningCountdown === 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setWarningCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [open, stage, warningCountdown]);

  useEffect(() => {
    if (!open || stage !== "success") {
      return;
    }

    if (successCountdown === 0) {
      window.location.reload();
      return;
    }

    const timer = window.setTimeout(() => {
      setSuccessCountdown((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [open, stage, successCountdown]);

  if (!open) return null;

  const socialProviderName = formatProviderName(socialProvider);

  const isInvalidPasswordError = (message?: string, code?: string) =>
    code === "INVALID_PASSWORD" ||
    message === authClient.$ERROR_CODES.INVALID_PASSWORD;

  const isCredentialAccountNotFoundError = (message?: string, code?: string) =>
    code === "CREDENTIAL_ACCOUNT_NOT_FOUND" ||
    message === authClient.$ERROR_CODES.CREDENTIAL_ACCOUNT_NOT_FOUND;

  const isSessionExpiredError = (message?: string, code?: string) =>
    code === "SESSION_EXPIRED" ||
    message === authClient.$ERROR_CODES.SESSION_EXPIRED;

  const handleProceed = () => {
    setStage("confirm");
    setError(null);
  };

  const handleBack = () => {
    if (isDeleting) return;
    setStage("warning");
    setError(null);
  };

  const handleDelete = async (event?: DeleteEvent) => {
    event?.preventDefault();
    setError(null);

    if (deleteMethod === "password" && !password) {
      setError("Please enter your password.");
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      let res =
        deleteMethod === "password"
          ? await authClient.deleteUser({
              password,
            })
          : await authClient.deleteUser({});

      if (
        res?.error &&
        deleteMethod === "password" &&
        isCredentialAccountNotFoundError(res.error.message, res.error.code)
      ) {
        setDeleteMethod("recent-session");
        setPassword("");
        res = await authClient.deleteUser({});
      }

      if (res?.error) {
        if (isInvalidPasswordError(res.error.message, res.error.code)) {
          setError("Incorrect password.");
        } else if (
          isCredentialAccountNotFoundError(res.error.message, res.error.code)
        ) {
          setError(
            "This account uses social sign-in. Sign in again and retry deleting without a password."
          );
        } else if (isSessionExpiredError(res.error.message, res.error.code)) {
          setError(
            "Your session expired. Sign in again with your provider, then retry deleting your account."
          );
        } else {
          setError(res.error.message || "Failed to delete account.");
        }
        return;
      }
      setStage("success");
      setSuccessCountdown(SUCCESS_COUNTDOWN);
    } catch (err) {
      console.error("Delete account failed:", err);
      setError("Failed to delete account. Please try again later.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="modal">
      {stage === "warning" && (
        <div className="modal-content confirm-modal delete-account-form">
          <h3>Delete Account?</h3>
          <div className="delete-account-body">
            <p>
              This permanently deletes your account and signs you out everywhere.
            </p>
            {warningCountdown !== 0 && (
              <p className="delete-account-countdown">
               Proceed unlocks in {warningCountdown}s.
              </p>
            )}
          </div>

          <div className="btn-row">
            <button
              type="button"
              className="neg-btn"
              onClick={handleProceed}
              disabled={warningCountdown > 0 || isLoadingDeleteMethod}
            >
              Proceed
            </button>
            <button type="button" className="pos-btn" onClick={onClose}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {stage === "confirm" && (
        <div className="modal-content confirm-modal delete-account-form">
          <h3>Confirm Deletion</h3>
          <form className="delete-account-body" onSubmit={handleDelete}>
            {isLoadingDeleteMethod ? (
              <p>Checking how this account signs in...</p>
            ) : deleteMethod === "password" ? (
              <>
                <p>Enter your password to permanently delete this account.</p>
                <input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    setError(null);
                  }}
                  autoComplete="current-password"
                />
              </>
            ) : (
              <>
                <p>
                  This account uses {socialProviderName} sign-in. You do not
                  need a Lifeline password to delete it.
                </p>
                <p className="delete-account-helper">
                  For security, deletion only works right after you sign in. If
                  it fails, sign in again and retry immediately.
                </p>
              </>
            )}
            {error && <p className="error">{error}</p>}
          </form>

          <div className="btn-row">
            <button
              type="button"
              className="neg-btn"
              onClick={handleDelete}
              disabled={isDeleting || isLoadingDeleteMethod}
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
             <button
              type="button"
              className="pos-btn"
              onClick={handleBack}
              disabled={isDeleting}
            >
              Back
            </button>
          </div>
        </div>
      )}

      {stage === "success" && (
        <div className="modal-content confirm-modal delete-account-form">
          <h3>Account deleted</h3>
          <div className="delete-account-body">
            <p>Your account has been deleted successfully.</p>
            {successCountdown !== 0 && (
              <p className="delete-account-countdown">
                Refreshing in {successCountdown}s.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
