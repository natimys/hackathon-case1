import { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { VideoView, useVideoPlayer } from "expo-video";
import { AppText } from "@/shared/ui/components";
import { theme } from "@/shared/config/theme";

export function HlsPlayer({
  cameraName,
  uri,
  token,
  compact,
  onPlaybackError,
}: {
  cameraName: string;
  uri: string;
  token: string;
  compact: boolean;
  onPlaybackError: () => void;
}) {
  const player = useVideoPlayer({
    uri,
    contentType: "hls",
    headers: { Authorization: `Bearer ${token}` },
  }, (instance) => {
    instance.muted = true;
    instance.loop = true;
    instance.play();
  });

  useEffect(() => {
    const subscription = player.addListener("statusChange", (event) => {
      if (event.status === "error") onPlaybackError();
    });
    return () => subscription.remove();
  }, [onPlaybackError, player]);

  return (
    <View style={[styles.surface, compact && styles.compact]}>
      <VideoView
        player={player}
        style={StyleSheet.absoluteFill}
        contentFit="contain"
        nativeControls={!compact}
        fullscreenOptions={{ enable: !compact }}
        surfaceType={compact ? "textureView" : "surfaceView"}
      />
      <View style={styles.caption}>
        <AppText variant="caption" style={styles.captionText}>{cameraName}</AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  surface: { width: "100%", aspectRatio: 16 / 9, backgroundColor: theme.colors.videoBackground, overflow: "hidden", borderRadius: theme.radius.card },
  compact: { aspectRatio: 16 / 9 },
  caption: { position: "absolute", left: 8, right: 8, bottom: 8, padding: 6, backgroundColor: theme.colors.videoOverlay, borderRadius: theme.radius.xs },
  captionText: { color: theme.colors.videoText },
});
