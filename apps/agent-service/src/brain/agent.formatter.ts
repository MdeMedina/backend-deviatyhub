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

    // Las notas de sistema (derivaciones, corta-bucles) son para el equipo: el
    // modelo las leería como si las hubiera dicho él.
    filteredHistory = filteredHistory.filter((m) => String(m.role || '').toLowerCase() !== 'system');

    return filteredHistory.map(msg => {
      const role = msg.role?.toLowerCase();
      if (role === 'user' || role === 'human') {
        return new HumanMessage(msg.content);
      }
      return new AIMessage(msg.content);
    });
  }
}
