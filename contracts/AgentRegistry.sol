// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract AgentRegistry {
    struct Agent {
        address owner;
        string name;
        string role;
        string agentURI;
        bytes32 capabilitiesHash;
        bytes32 contextPolicyHash;
        bool active;
        uint256 createdAt;
    }

    uint256 public nextAgentId = 1;
    mapping(uint256 => Agent) public agents;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string name, string role);
    event AgentUpdated(uint256 indexed agentId, string agentURI, bool active);

    function registerAgent(
        string calldata name,
        string calldata role,
        string calldata agentURI,
        bytes32 capabilitiesHash,
        bytes32 contextPolicyHash
    ) external returns (uint256 agentId) {
        agentId = nextAgentId++;
        agents[agentId] = Agent({
            owner: msg.sender,
            name: name,
            role: role,
            agentURI: agentURI,
            capabilitiesHash: capabilitiesHash,
            contextPolicyHash: contextPolicyHash,
            active: true,
            createdAt: block.timestamp
        });
        emit AgentRegistered(agentId, msg.sender, name, role);
    }

    function updateAgent(
        uint256 agentId,
        string calldata agentURI,
        bytes32 capabilitiesHash,
        bytes32 contextPolicyHash,
        bool active
    ) external {
        Agent storage agent = agents[agentId];
        require(agent.owner != address(0), "agent missing");
        require(agent.owner == msg.sender, "not owner");
        agent.agentURI = agentURI;
        agent.capabilitiesHash = capabilitiesHash;
        agent.contextPolicyHash = contextPolicyHash;
        agent.active = active;
        emit AgentUpdated(agentId, agentURI, active);
    }

    function getAgent(uint256 agentId) external view returns (Agent memory) {
        return agents[agentId];
    }
}
