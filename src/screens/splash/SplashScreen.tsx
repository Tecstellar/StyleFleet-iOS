import React, { Component, ReactNode, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  ActivityIndicator,
  Image,
  TouchableOpacity,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useTheme } from '../../theme/ThemeContext';

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
    console.warn('Video playback unavailable, transitioning to emblem:', error);
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
  const { colors } = useTheme();

  // Mode: 'video' | 'emblem'
  const [playVideo, setPlayVideo] = useState(true);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.92)).current;

  // Transition to emblem stage
  const handleVideoEnd = () => {
    setPlayVideo(false);
  };

  // Safety fallback timer: if video doesn't end within 7s, transition to emblem
  useEffect(() => {
    if (playVideo) {
      const timeout = setTimeout(() => {
        handleVideoEnd();
      }, 7000);
      return () => clearTimeout(timeout);
    }
  }, [playVideo]);

  useEffect(() => {
    if (!playVideo) {
      // Animate emblem in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start();

      const timer = setTimeout(() => {
        if (isReady) {
          onFinish();
        }
      }, 1400);

      return () => clearTimeout(timer);
    }
  }, [playVideo, isReady]);

  return (
    <View style={[styles.container, { backgroundColor: '#0b0c15' }]}>
      {playVideo ? (
        <View style={StyleSheet.absoluteFill}>
          <VideoErrorBoundary onError={handleVideoEnd}>
            <IntroVideoPlayer onEnd={handleVideoEnd} />
          </VideoErrorBoundary>

          {/* Skip Intro button */}
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleVideoEnd}
            style={styles.skipButton}
          >
            <Text style={styles.skipText}>Skip ➔</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <Animated.View
          style={[
            styles.content,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* StyleFleet Emblem - Square with uploaded app icon */}
          <View
            style={[
              styles.logoBadge,
              {
                backgroundColor: colors.surface,
                borderColor: colors.accent,
              },
            ]}
          >
            <Image
              source={require('../../assets/app_icon.png')}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <Text style={[styles.title, { color: colors.text }]}>
            STYLE<Text style={{ color: colors.accent }}>FLEET</Text>
          </Text>
          <Text style={[styles.subtitle, { color: colors.textDim }]}>
            Smart Salon OS & Operations
          </Text>

          <View style={styles.loaderContainer}>
            <ActivityIndicator size="small" color={colors.accent} />
            <Text style={[styles.loadingText, { color: colors.textMuted }]}>
              Loading your salon workspace...
            </Text>
          </View>

          <View style={styles.footer}>
            <Text style={[styles.versionText, { color: colors.textMuted }]}>
              v1.0.0 · StyleFleet Cloud Engine
            </Text>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0b0c15',
  },
  content: {
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  skipButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(217, 164, 65, 0.4)',
    zIndex: 10,
  },
  skipText: {
    color: '#D4AF37',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
  },
  logoBadge: {
    width: 84,
    height: 84,
    borderRadius: 24,
    borderWidth: 1.5,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 16,
    elevation: 8,
  },
  logoImage: {
    width: 80,
    height: 80,
    borderRadius: 22,
  },
  title: {
    fontSize: 32,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontWeight: '400',
    letterSpacing: 0.4,
    marginBottom: 40,
  },
  loaderContainer: {
    alignItems: 'center',
    marginTop: 20,
  },
  loadingText: {
    fontSize: 12,
    marginTop: 10,
    letterSpacing: 0.2,
  },
  footer: {
    marginTop: 40,
  },
  versionText: {
    fontSize: 11,
    letterSpacing: 0.5,
  },
});
