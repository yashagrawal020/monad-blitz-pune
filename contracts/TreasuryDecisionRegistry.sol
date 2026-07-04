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

    mapping(uint256 => Decision) public decisionsByProposalId;
    mapping(uint256 => bool) public decisionExists;

    event DecisionRecorded(
        uint256 indexed proposalId,
        address indexed proposer,
        bytes32 finalDecisionHash
    );

    function recordDecision(Decision calldata decision) external returns (uint256 recordedProposalId) {
        require(!decisionExists[decision.proposalId], "decision exists");
        require(decision.proposalHash != bytes32(0), "proposal hash required");
        require(decision.researchReportHash != bytes32(0), "research hash required");
        require(decision.skepticReportHash != bytes32(0), "skeptic hash required");
        require(decision.finalDecisionHash != bytes32(0), "decision hash required");
        _validateVote(decision.researchVote);
        _validateVote(decision.skepticVote);
        _validateVote(decision.councilVote);

        decisionExists[decision.proposalId] = true;
        decisionsByProposalId[decision.proposalId] = Decision({
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
        emit DecisionRecorded(decision.proposalId, msg.sender, decision.finalDecisionHash);
        return decision.proposalId;
    }

    function getDecisionByProposal(uint256 proposalId) external view returns (Decision memory) {
        require(decisionExists[proposalId], "decision missing");
        return decisionsByProposalId[proposalId];
    }

    function _validateVote(uint8 vote) internal pure {
        require(vote <= 3, "invalid vote");
    }
}
