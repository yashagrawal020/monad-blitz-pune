// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract TreasuryDecisionRegistry {
    struct Decision {
        uint256 proposalId;
        address proposer;
        uint256 researchAgentId;
        uint256 skepticAgentId;
        uint256 councilAgentId;
        bytes32 proposalHash;
        bytes32 researchReportHash;
        bytes32 skepticReportHash;
        bytes32 finalDecisionHash;
        uint8 researchVote;
        uint8 skepticVote;
        uint8 councilVote;
        string decisionURI;
        uint256 createdAt;
    }

    uint256 public nextDecisionId = 1;
    mapping(uint256 => Decision) public decisions;
    mapping(uint256 => uint256[]) public decisionsByProposal;

    event DecisionRecorded(
        uint256 indexed decisionId,
        uint256 indexed proposalId,
        address indexed proposer,
        bytes32 finalDecisionHash
    );

    function recordDecision(Decision calldata decision) external returns (uint256 decisionId) {
        require(decision.proposalHash != bytes32(0), "proposal hash required");
        require(decision.researchReportHash != bytes32(0), "research hash required");
        require(decision.skepticReportHash != bytes32(0), "skeptic hash required");
        require(decision.finalDecisionHash != bytes32(0), "decision hash required");
        _validateVote(decision.researchVote);
        _validateVote(decision.skepticVote);
        _validateVote(decision.councilVote);

        decisionId = nextDecisionId++;
        decisions[decisionId] = Decision({
            proposalId: decision.proposalId,
            proposer: msg.sender,
            researchAgentId: decision.researchAgentId,
            skepticAgentId: decision.skepticAgentId,
            councilAgentId: decision.councilAgentId,
            proposalHash: decision.proposalHash,
            researchReportHash: decision.researchReportHash,
            skepticReportHash: decision.skepticReportHash,
            finalDecisionHash: decision.finalDecisionHash,
            researchVote: decision.researchVote,
            skepticVote: decision.skepticVote,
            councilVote: decision.councilVote,
            decisionURI: decision.decisionURI,
            createdAt: block.timestamp
        });
        decisionsByProposal[decision.proposalId].push(decisionId);
        emit DecisionRecorded(decisionId, decision.proposalId, msg.sender, decision.finalDecisionHash);
    }

    function getDecision(uint256 decisionId) external view returns (Decision memory) {
        return decisions[decisionId];
    }

    function getDecisionsByProposal(uint256 proposalId) external view returns (uint256[] memory) {
        return decisionsByProposal[proposalId];
    }

    function _validateVote(uint8 vote) internal pure {
        require(vote <= 3, "invalid vote");
    }
}
