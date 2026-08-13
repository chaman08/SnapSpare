import { useCallback, useEffect, useRef, useState } from 'react'

/** Simple one-second-tick countdown, used for the OTP resend timer. */
export function useCountdown(initialSeconds: number) {
  const [remaining, setRemaining] = useState(initialSeconds)
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((prev) => (prev <= 0 ? 0 : prev - 1))
    }, 1000)
    return () => clearInterval(intervalRef.current)
  }, [])

  const restart = useCallback((seconds: number = initialSeconds) => {
    setRemaining(seconds)
  }, [initialSeconds])

  return { remaining, restart }
}
