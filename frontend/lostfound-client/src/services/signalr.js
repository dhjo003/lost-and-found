import * as signalR from '@microsoft/signalr';

let connection = null;
const handlers = {
  ReceiveMessage: new Set(),
  ReceiveNotification: new Set(),
  MessageSent: new Set(),
  MessageRead: new Set(),
  ConversationDeleted: new Set()
};

export async function start(token) {
  if (connection) return connection;

  connection = new signalR.HubConnectionBuilder()
    .withUrl('/hubs/messages', {
      accessTokenFactory: () => token || localStorage.getItem('app_jwt') || ''
    })
    .withAutomaticReconnect()
    .configureLogging(signalR.LogLevel.Warning)
    .build();

  connection.on('ReceiveMessage', payload => handlers.ReceiveMessage.forEach(h => h(payload)));
  connection.on('ReceiveNotification', payload => handlers.ReceiveNotification.forEach(h => h(payload)));
  connection.on('MessageSent', payload => handlers.MessageSent.forEach(h => h(payload)));
  connection.on('MessageRead', payload => handlers.MessageRead.forEach(h => h(payload)));
  connection.on('ConversationDeleted', payload => handlers.ConversationDeleted.forEach(h => h(payload)));

  // start connection (retry errors are surfaced to caller)
  await connection.start();
  return connection;
}

export async function stop() {
  if (!connection) return;
  try {
    await connection.stop();
  } finally {
    connection = null;
  }
}

// register a handler, returns an unsubscribe function
export function on(event, callback) {
  if (!handlers[event]) handlers[event] = new Set();
  handlers[event].add(callback);
  return () => {
    handlers[event].delete(callback);
  };
}

// optional: call hub method directly
export async function sendViaHub(receiverId, content) {
  if (!connection) throw new Error('SignalR connection not started');
  return connection.invoke('SendPrivateMessage', receiverId, content);
}

export default {
  start,
  stop,
  on,
  sendViaHub
};