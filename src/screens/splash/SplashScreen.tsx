import React, { Component, ReactNode, useEffect, useRef, useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

interface SplashScreenProps {
  onFinish: () => void;
  isReady?: boolean;
}

// Error boundary to gracefully catch any native video module issue
class VideoErrorBoundary extends Component<
  { onError: () => void; children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown) {
    console.warn('Video playback unavailable, proceeding directly:', error);
    this.props.onError();
  }

  render() {
    if (this.state.hasError) {
      return null;
    }
    return this.props.children;
  }
}

const IntroVideoPlayer: React.FC<{ onEnd: () => void }> = ({ onEnd }) => {
  const videoSource = require('../../assets/intro_video.mp4');

  const player = useVideoPlayer(videoSource, (p) => {
    p.loop = false;
    p.play();
  });

  useEffect(() => {
    const subEnd = player.addListener('playToEnd', () => {
      onEnd();
    });
    const subStatus = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error' || error) {
        console.warn('Intro video error:', error);
        onEnd();
      }
    });

    return () => {
      subEnd?.remove();
      subStatus?.remove();
    };
  }, [player, onEnd]);

  return (
    <VideoView
      style={StyleSheet.absoluteFill}
      player={player}
      nativeControls={false}
      contentFit="cover"
    />
  );
};

export const SplashScreen: React.FC<SplashScreenProps> = ({ onFinish, isReady = true }) => {
  const [videoFinished, setVideoFinished] = useState(false);
  const finishedRef = useRef(false);

  const handleFinish = () => {
    if (!finishedRef.current) {
      finishedRef.current = true;
      onFinish();
    }
  };

  const onVideoEnded = () => {
    setVideoFinished(true);
  };

  // If video finished and app initialization is ready, transition directly (no logo screen)
  useEffect(() => {
    if (videoFinished && isReady) {
      handleFinish();
    }
  }, [videoFinished, isReady]);

  // Safety fallback timer: if video doesn't end within 5s, proceed directly
  useEffect(() => {
    const timeout = setTimeout(() => {
      setVideoFinished(true);
      if (isReady) {
        handleFinish();
      }
    }, 5000);
    return () => clearTimeout(timeout);
  }, [isReady]);

  return (
    <View style={styles.container}>
      <VideoErrorBoundary onError={() => { setVideoFinished(true); handleFinish(); }}>
        <IntroVideoPlayer onEnd={onVideoEnded} />
      </VideoErrorBoundary>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0c15',
  },
});
