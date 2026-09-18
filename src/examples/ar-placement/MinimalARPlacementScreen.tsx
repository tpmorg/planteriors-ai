import React, { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  ARPlacementView,
  createViroAdapter,
  useARPlacement,
  type ContentDescriptor,
  type RenderObject,
} from '../../modules/ar-placement';

const BOX: ContentDescriptor = {
  contentId: 'asymmetric-box',
  dimensions: { width: 0.2, height: 0.4, depth: 0.1 },
  pivot: [0, 0.2, 0],
  minScale: 0.5,
  maxScale: 2,
};

export function MinimalARPlacementScreen({ onClose }: { onClose: () => void }) {
  const [adapter] = useState(() => createViroAdapter());
  const [renderObject, setRenderObject] = useState<RenderObject | null>(null);
  const ar = useARPlacement({
    adapter,
    contents: [BOX],
    policy: { maxObjects: 1 },
  });
  const object = ar.snapshot.objects[0];

  const start = useCallback(async () => {
    const mod = await import('./asymmetricBox');
    setRenderObject(() => mod.renderAsymmetricBox);
    await ar.start();
  }, [ar]);

  return (
    <View style={styles.fill}>
      {renderObject && ar.snapshot.session.lifecycle !== 'idle' ? (
        <ARPlacementView controller={ar.controller} renderObject={renderObject} />
      ) : (
        <View style={styles.fill} />
      )}
      <SafeAreaView style={styles.hud} pointerEvents="box-none">
        <Text style={styles.copy}>{ar.snapshot.feedback.code}</Text>
        <View style={styles.row}>
          <TouchableOpacity style={styles.button} onPress={() => void start()}>
            <Text style={styles.buttonText}>Start</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => void ar.place({ contentId: 'asymmetric-box' })}
            disabled={!ar.snapshot.target?.ready}
          >
            <Text style={styles.buttonText}>Place</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => object && void ar.remove(object.id)}
            disabled={!object}
          >
            <Text style={styles.buttonText}>Remove</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.button}
            onPress={() => {
              void ar.stop();
              onClose();
            }}
          >
            <Text style={styles.buttonText}>Close</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: '#000' },
  hud: { position: 'absolute', left: 0, right: 0, bottom: 24, paddingHorizontal: 16 },
  copy: { color: '#fff', textAlign: 'center', marginBottom: 12 },
  row: { flexDirection: 'row', gap: 8 },
  button: { flex: 1, backgroundColor: '#222', paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '600' },
});
