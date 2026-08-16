import { HumanMessage, AIMessage, BaseMessage } from '@langchain/core/messages';

export class AgentFormatter {
  static formatHistory(history: any[], currentUserInput?: string): BaseMessage[] {
    let filteredHistory = [...history];
    if (filteredHistory.length > 0) {
      const lastMsg = filteredHistory[filteredHistory.length - 1];
      const lastRole = lastMsg.role?.toLowerCase();
      const isUser = lastRole === 'user' || lastRole === 'human';
      const matchesInput = lastMsg.content === currentUserInput;
      if (isUser && matchesInput) {
        filteredHistory.pop();
      }
    }

    return filteredHistory.map(msg => {
      const role = msg.role?.toLowerCase();
      if (role === 'user' || role === 'human') {
        return new HumanMessage(msg.content);
      }
      return new AIMessage(msg.content);
    });
  }
}
