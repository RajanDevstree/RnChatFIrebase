import React from 'react';
import {StyleSheet, Dimensions} from 'react-native';
import {Button} from 'react-native-paper';

const {width, height} = Dimensions.get('screen');

export default function FormButton({title, modeValue, ...rest}) {
  return (
    <Button
      mode={modeValue}
      {...rest}
      style={styles.button}
      labelStyle={styles.textStyle}
      contentStyle={styles.buttonContainer}>
      {title}
    </Button>
  );
}

const styles = StyleSheet.create({
  button: {
    marginTop: 10,
  },
  textStyle: {
    color: '#FFFFFF',
  },
  buttonContainer: {
    backgroundColor: '#0d9eff',
    color: '#ffffff',
    width: width / 2,
    height: height / 15,
  },
});
