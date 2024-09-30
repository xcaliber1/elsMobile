import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated } from 'react-native';

const CustomToggleSwitch = ({ value, onValueChange }) => {
  const [animation] = useState(new Animated.Value(value ? 1 : 0));

  const toggleSwitch = () => {
    const newValue = !value;
    Animated.timing(animation, {
      toValue: newValue ? 1 : 0,
      duration: 200,
      useNativeDriver: false,
    }).start();
    onValueChange(newValue);
  };

  const switchTranslateX = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 25],
  });

  const switchColor = animation.interpolate({
    inputRange: [0, 1],
    outputRange: ['gray', 'blue'],
  });

  return (
    <TouchableOpacity onPress={toggleSwitch} style={styles.switchContainer}>
      <Animated.View style={[styles.switch, { backgroundColor: switchColor }]}>
        <Animated.View style={[styles.switchThumb, { transform: [{ translateX: switchTranslateX }] }]} />
      </Animated.View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  switchContainer: {
    width: 50,
    height: 25,
    borderRadius: 25,
    justifyContent: 'center',
  },
  switch: {
    width: '100%',
    height: '100%',
    borderRadius: 25,
    padding: 3,
  },
  switchThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: 'white',
  },
});

export default CustomToggleSwitch;
