use serde::Serialize;
use utoipa::ToSchema;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum RiskSeverity {
    Low,
    Medium,
    High,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct RiskFlag {
    pub flag_type: String,
    pub severity: RiskSeverity,
    pub message: String,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct RisksResponse {
    pub address: String,
    pub risk_score: u8,
    pub flags: Vec<RiskFlag>,
}
