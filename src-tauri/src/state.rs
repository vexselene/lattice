//! Global application state and in-memory rate limiting / backoff tracker.

use std::time::{Duration, Instant};
use zeroize::Zeroizing;

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum BackoffError {
    #[error("Rate limited: must wait {wait_remaining:?} before next unlock attempt")]
    RateLimited { wait_remaining: Duration },
}

/// Shared application state managed by Tauri.
pub struct AppState {
    pub db: Option<rusqlite::Connection>,
    pub encryption_key: Option<Zeroizing<[u8; 32]>>,
    pub failed_attempts: u32,
    pub last_attempt_at: Option<Instant>,
}

impl AppState {
    pub fn new() -> Self {
        Self {
            db: None,
            encryption_key: None,
            failed_attempts: 0,
            last_attempt_at: None,
        }
    }

    /// Calculates the required backoff wait duration based on the attempt number.
    ///
    /// - Attempts 1..=3: No delay (0s)
    /// - Attempt 4: 1s
    /// - Attempt 5: 2s
    /// - Attempt 6+: Doubled each time (4s, 8s, 16s, 30s), capped at 30s
    pub fn calculate_backoff_duration(attempt: u32) -> Duration {
        if attempt <= 3 {
            Duration::ZERO
        } else {
            let exp = attempt - 4;
            let secs = 1u64.checked_shl(exp).unwrap_or(u64::MAX);
            Duration::from_secs(secs.min(30))
        }
    }

    /// Checks if an attempt is currently permitted under the backoff schedule.
    ///
    /// If the required delay since `last_attempt_at` has not elapsed, returns
    /// `Err(BackoffError::RateLimited)` with the remaining wait duration.
    /// Otherwise returns `Ok(required_wait)` for this attempt.
    pub fn check_attempt(&self) -> Result<Duration, BackoffError> {
        self.check_attempt_at(Instant::now())
    }

    /// Internal helper supporting custom timestamps for deterministic testing.
    pub fn check_attempt_at(&self, now: Instant) -> Result<Duration, BackoffError> {
        let next_attempt = self.failed_attempts + 1;
        let required_gap = Self::calculate_backoff_duration(next_attempt);

        if let Some(last) = self.last_attempt_at {
            if required_gap > Duration::ZERO {
                let elapsed = now.saturating_duration_since(last);
                if elapsed < required_gap {
                    return Err(BackoffError::RateLimited {
                        wait_remaining: required_gap - elapsed,
                    });
                }
            }
        }

        Ok(required_gap)
    }

    /// Records an attempt directly without failing on rate-limits, returning the
    /// required delay for that attempt. Useful for state updates and testing.
    pub fn record_attempt(&mut self, success: bool) -> Duration {
        self.record_attempt_at(success, Instant::now())
    }

    /// Internal helper supporting custom timestamps for deterministic testing.
    pub fn record_attempt_at(&mut self, success: bool, now: Instant) -> Duration {
        if success {
            self.failed_attempts = 0;
            self.last_attempt_at = None;
            Duration::ZERO
        } else {
            self.failed_attempts = self.failed_attempts.saturating_add(1);
            self.last_attempt_at = Some(now);
            Self::calculate_backoff_duration(self.failed_attempts)
        }
    }

    /// Verifies that any required backoff delay has passed, and records the attempt.
    ///
    /// - If called before the backoff interval has elapsed, returns `Err(BackoffError::RateLimited)`.
    /// - On `success == true`, resets `failed_attempts` to 0 and clears `last_attempt_at`.
    /// - On `success == false`, increments `failed_attempts`, updates `last_attempt_at`,
    ///   and returns `Ok(wait_duration)` describing how long the caller must wait before
    ///   the next attempt.
    pub fn check_and_record_attempt(&mut self, success: bool) -> Result<Duration, BackoffError> {
        self.check_and_record_attempt_at(success, Instant::now())
    }

    /// Internal helper supporting custom timestamps for deterministic testing.
    pub fn check_and_record_attempt_at(
        &mut self,
        success: bool,
        now: Instant,
    ) -> Result<Duration, BackoffError> {
        self.check_attempt_at(now)?;
        Ok(self.record_attempt_at(success, now))
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_backoff_durations_formula() {
        assert_eq!(AppState::calculate_backoff_duration(0), Duration::from_secs(0));
        assert_eq!(AppState::calculate_backoff_duration(1), Duration::from_secs(0));
        assert_eq!(AppState::calculate_backoff_duration(2), Duration::from_secs(0));
        assert_eq!(AppState::calculate_backoff_duration(3), Duration::from_secs(0));
        assert_eq!(AppState::calculate_backoff_duration(4), Duration::from_secs(1));
        assert_eq!(AppState::calculate_backoff_duration(5), Duration::from_secs(2));
        assert_eq!(AppState::calculate_backoff_duration(6), Duration::from_secs(4));
        assert_eq!(AppState::calculate_backoff_duration(7), Duration::from_secs(8));
        assert_eq!(AppState::calculate_backoff_duration(8), Duration::from_secs(16));
        assert_eq!(AppState::calculate_backoff_duration(9), Duration::from_secs(30));
        assert_eq!(AppState::calculate_backoff_duration(10), Duration::from_secs(30));
        assert_eq!(AppState::calculate_backoff_duration(100), Duration::from_secs(30));
    }

    #[test]
    fn test_record_attempt_increments_and_resets() {
        let mut state = AppState::new();

        // Attempts 1..=3 produce 0s delay
        assert_eq!(state.record_attempt(false), Duration::from_secs(0));
        assert_eq!(state.failed_attempts, 1);
        assert_eq!(state.record_attempt(false), Duration::from_secs(0));
        assert_eq!(state.failed_attempts, 2);
        assert_eq!(state.record_attempt(false), Duration::from_secs(0));
        assert_eq!(state.failed_attempts, 3);

        // Attempt 4 produces 1s delay
        assert_eq!(state.record_attempt(false), Duration::from_secs(1));
        assert_eq!(state.failed_attempts, 4);

        // Attempt 5 produces 2s delay
        assert_eq!(state.record_attempt(false), Duration::from_secs(2));
        assert_eq!(state.failed_attempts, 5);

        // Attempt 6 produces 4s delay
        assert_eq!(state.record_attempt(false), Duration::from_secs(4));
        assert_eq!(state.failed_attempts, 6);

        // Success resets counter and timestamp
        assert_eq!(state.record_attempt(true), Duration::from_secs(0));
        assert_eq!(state.failed_attempts, 0);
        assert!(state.last_attempt_at.is_none());
    }

    #[test]
    fn test_check_and_record_enforces_rate_limit() {
        let mut state = AppState::new();
        let base_time = Instant::now();

        // 3 failed attempts without delay
        assert!(state.check_and_record_attempt_at(false, base_time).is_ok());
        assert!(state.check_and_record_attempt_at(false, base_time).is_ok());
        assert!(state.check_and_record_attempt_at(false, base_time).is_ok());

        // 4th attempt immediately at base_time should fail with RateLimited (needs 1s gap)
        let too_soon = state.check_and_record_attempt_at(false, base_time);
        assert_eq!(
            too_soon,
            Err(BackoffError::RateLimited {
                wait_remaining: Duration::from_secs(1)
            })
        );

        // 4th attempt after 500ms should still fail (needs remaining 500ms)
        let partial_time = base_time + Duration::from_millis(500);
        let partial = state.check_and_record_attempt_at(false, partial_time);
        assert_eq!(
            partial,
            Err(BackoffError::RateLimited {
                wait_remaining: Duration::from_millis(500)
            })
        );

        // 4th attempt after full 1s gap succeeds
        let valid_time_4 = base_time + Duration::from_secs(1);
        let res4 = state.check_and_record_attempt_at(false, valid_time_4);
        assert_eq!(res4, Ok(Duration::from_secs(1)));
        assert_eq!(state.failed_attempts, 4);

        // 5th attempt after 1s should fail (needs 2s gap from valid_time_4)
        let early_5 = valid_time_4 + Duration::from_secs(1);
        assert!(state.check_and_record_attempt_at(false, early_5).is_err());

        // 5th attempt after 2s succeeds
        let valid_time_5 = valid_time_4 + Duration::from_secs(2);
        let res5 = state.check_and_record_attempt_at(false, valid_time_5);
        assert_eq!(res5, Ok(Duration::from_secs(2)));
        assert_eq!(state.failed_attempts, 5);

        // 6th attempt after 4s succeeds
        let valid_time_6 = valid_time_5 + Duration::from_secs(4);
        let res6 = state.check_and_record_attempt_at(false, valid_time_6);
        assert_eq!(res6, Ok(Duration::from_secs(4)));
        assert_eq!(state.failed_attempts, 6);
    }
}
