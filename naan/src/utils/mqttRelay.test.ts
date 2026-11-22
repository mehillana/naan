import assert from 'node:assert/strict';
import test from 'node:test';
import {
  MqttPacketReader,
  decryptRelayJson,
  deriveRelayTopicPrefix,
  encodeMqttConnect,
  encodeMqttPublish,
  encodeMqttRemainingLength,
  encodeMqttSubscribe,
  encryptRelayJson,
} from './mqttRelay.ts';

test('encodeMqttRemainingLength handles single-byte and multi-byte varints', () => {
  assert.deepEqual(Array.from(encodeMqttRemainingLength(0)), [0]);
  assert.deepEqual(Array.from(encodeMqttRemainingLength(127)), [127]);
  assert.deepEqual(Array.from(encodeMqttRemainingLength(128)), [0x80, 0x01]);
  assert.deepEqual(Array.from(encodeMqttRemainingLength(16384)), [0x80, 0x80, 0x01]);
});

test('MQTT connect, subscribe, and fragmented publish round-trip cleanly', () => {
  const connectPkt = encodeMqttConnect('naan_test_1', 30);
  assert.equal(connectPkt[0], 0x10);

  const subPkt = encodeMqttSubscribe(42, ['naan/r1/abc/ev', 'naan/r1/abc/snap']);
  assert.equal(subPkt[0], 0x82);

  const largePayload = new Uint8Array(300);
  for (let i = 0; i < largePayload.length; i += 1) largePayload[i] = i & 0xff;
  const pubPkt = encodeMqttPublish('naan/r1/abc/ev', largePayload, true);
  assert.equal(pubPkt[0], 0x31); // PUBLISH QoS 0 with retain flag

  // Feed in 3 fragmented chunks to MqttPacketReader
  const reader = new MqttPacketReader();
  assert.equal(reader.push(pubPkt.subarray(0, 5)).length, 0);
  assert.equal(reader.push(pubPkt.subarray(5, 80)).length, 0);
  const parsed = reader.push(pubPkt.subarray(80));
  assert.equal(parsed.length, 1);
  assert.equal(parsed[0].packetType, 3);
  assert.equal(parsed[0].topic, 'naan/r1/abc/ev');
  assert.deepEqual(Array.from(parsed[0].payload), Array.from(largePayload));
});

test('deriveRelayTopicPrefix and AES-GCM relay encryption protect room privacy', async () => {
  const topicA = await deriveRelayTopicPrefix('ROOM42');
  const topicB = await deriveRelayTopicPrefix('room42');
  const topicC = await deriveRelayTopicPrefix('OTHER9');
  assert.equal(topicA, topicB);
  assert.notEqual(topicA, topicC);
  assert.equal(topicA.includes('ROOM42'), false);

  const sample = {kind: 'message:send', text: 'Hola des de GitHub Pages! 🎉', n: 42};
  const encrypted = await encryptRelayJson('ROOM42', sample);
  assert.equal(encrypted[0], 0x01);

  const decrypted = await decryptRelayJson<typeof sample>('ROOM42', encrypted);
  assert.deepEqual(decrypted, sample);

  await assert.rejects(() => decryptRelayJson('WRONG1', encrypted));
});
