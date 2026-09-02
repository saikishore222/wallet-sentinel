use anyhow::{Context, Result};
use reqwest::{RequestBuilder, Response};
use std::time::Duration;

pub async fn send_with_retry(builder: RequestBuilder, attempts: u32) -> Result<Response> {
    let attempts = attempts.max(1);
    let mut last_error = None;

    for attempt in 0..attempts {
        let request = builder
            .try_clone()
            .context("request body is not retryable")?;

        match request.send().await {
            Ok(response) => {
                let status = response.status();
                if status.is_server_error() || status.as_u16() == 429 {
                    last_error = Some(anyhow::anyhow!("upstream HTTP {status}"));
                    if attempt + 1 < attempts {
                        tokio::time::sleep(backoff(attempt)).await;
                        continue;
                    }
                    return Ok(response);
                }
                return Ok(response);
            }
            Err(err) => {
                last_error = Some(err.into());
                if attempt + 1 < attempts {
                    tokio::time::sleep(backoff(attempt)).await;
                    continue;
                }
            }
        }
    }

    Err(last_error.unwrap_or_else(|| anyhow::anyhow!("request failed")))
}

fn backoff(attempt: u32) -> Duration {
    Duration::from_millis(200 * 2u64.pow(attempt))
}
