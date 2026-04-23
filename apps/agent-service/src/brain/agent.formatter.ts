import { HumanMessage, AIMessage, BaseMessage, SystemMessage } from '@langchain/core/messages';

export class AgentFormatter {
  static formatHistory(history: any[]): BaseMessage[] {
    return history.map(msg => {
      if (msg.role === 'user') {
        return new HumanMessage(msg.content);
      }
      return new AIMessage(msg.content);
    });
  }
}
