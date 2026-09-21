import { useEffect, useState } from 'react';
import { verifySignature, type SecretEncoding, type Verification } from '../lib/verify';

const IDLE: Verification = { status: 'idle', message: 'Add a key to check the signature' };
const PENDING: Verification = { status: 'idle', message: 'Checking…' };

/**
 * Verification is asynchronous because WebCrypto is.
 *
 * The answer is stored together with the inputs it was computed from, so a
 * stale "verified" can never be shown against a token or key that has since
 * changed — and the idle state is derived rather than assigned, which keeps
 * the effect free of synchronous state updates.
 */
export const useVerification = (
  token: string,
  algorithm: string | null,
  key: string,
  encoding: SecretEncoding,
): Verification => {
  const [answered, setAnswered] = useState<{ inputs: string; result: Verification } | null>(null);
  const inputs = JSON.stringify([token, algorithm, key, encoding]);

  useEffect(() => {
    if (key.trim() === '') return;

    let cancelled = false;
    void verifySignature(token, algorithm, key, encoding).then((result) => {
      if (!cancelled) setAnswered({ inputs, result });
    });

    return () => {
      cancelled = true;
    };
  }, [inputs, token, algorithm, key, encoding]);

  if (key.trim() === '') return IDLE;
  return answered?.inputs === inputs ? answered.result : PENDING;
};
