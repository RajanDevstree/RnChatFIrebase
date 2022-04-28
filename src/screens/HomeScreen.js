import React, {useState, useEffect} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  SafeAreaView,
  Text,
  Platform,
  Alert,
  Image,
  Button,
} from 'react-native';
import {List, Divider} from 'react-native-paper';
import firestore from '@react-native-firebase/firestore';
import Loading from '../components/Loading';
import useStatsBar from '../utils/useStatusBar';
import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import * as Progress from 'react-native-progress';
import Video from 'react-native-video';
import {createThumbnail} from 'react-native-create-thumbnail';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSet,
  AudioSourceAndroidType,
} from 'react-native-audio-recorder-player';
import RNFetchBlob from 'rn-fetch-blob';

 function HomeScreen({navigation}) {
  useStatsBar('light-content');
  const videoPlayer = React.useRef();
  var audioRecorderPlayer = new AudioRecorderPlayer();
  audioRecorderPlayer.setSubscriptionDuration(0.09);
  const [audioState, setAudioState] = useState({
    isLoggingIn: false,
    recordSecs: 0,
    recordTime: '00:00:00',
    currentPositionSec: 0,
    currentDurationSec: 0,
    playTime: '00:00:00',
    duration: '00:00:00',
  });

  const [threads, setThreads] = useState([]);
  const [loading, setLoading] = useState(true);

  /**
   * Fetch threads from Firestore
   */
  useEffect(() => {
    const unsubscribe = firestore()
      .collection('THREADS')
      .orderBy('latestMessage.createdAt', 'desc')
      .onSnapshot(querySnapshot => {
        const threads = querySnapshot.docs.map(documentSnapshot => {
          return {
            _id: documentSnapshot.id,
            // give defaults
            name: '',

            latestMessage: {
              text: '',
            },
            ...documentSnapshot.data(),
          };
        });

        console.log(threads);

        setThreads(threads);

        if (loading) {
          setLoading(false);
        }
      });

    /**
     * unsubscribe listener
     */
    return () => unsubscribe();
  }, []);

  if (loading) {
    return <Loading />;
  }

  const buttonPressHandler = () => {
    return true;
  };

  const selectImage = () => {
    const options = {
      // maxWidth: 2000,
      // maxHeight: 2000,
      // storageOptions: {
      // skipBackup: true,
      // path: 'images',
      // },
      mediaType: 'video',
      videoQuality: 'high',
    };
    launchImageLibrary(options, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
      } else {
        console.log(response['assets'][0].uri);
        uploadVider(response['assets'][0].uri);
      }
    });
  };

  const uploadVider = async VideoData => {
    if (VideoData) {
      const filename = VideoData.substring(VideoData.lastIndexOf('/') + 1);
      const uploadUri =
        Platform.OS === 'ios' ? VideoData.replace('file://', '') : VideoData;
      const task = storage().ref(`Rajan/video/${filename}`).putFile(uploadUri);
      task.on('state_changed', snapshot => {});
      try {
        task
          .then(() => {
            Alert.alert(
              'Video uploaded!',
              'Your Video has been uploaded to Firebase Cloud Storage!',
            );

            storage()
              .ref(`Rajan/video/${filename}`)
              .getDownloadURL()
              .then(downloadUrl => {
                console.log(downloadUrl, 'DDDDDDDDDDDDDDDDDDDDDDDDDDDD');
              });

            console.log('Image uploaded to the bucket!');
          })
          .catch(e => {
            alert(`${e} EEEEEE`);
          });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const onStartRecord = async () => {
    const dirs = RNFetchBlob.fs.dirs;
    const path = Platform.select({
      ios: `${new Date().getTime()}audio.m4a`,
      android: `${dirs.CacheDir}/${new Date().getTime()}audio.mp3`,
    });
    const audioSet = {
      AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
      AudioSourceAndroid: AudioSourceAndroidType.MIC,
      AVEncoderAudioQualityKeyIOS: AVEncoderAudioQualityIOSType.high,
      AVNumberOfChannelsKeyIOS: 2,
      AVFormatIDKeyIOS: AVEncodingOption.aac,
    };
    console.log('audioSet', audioSet);
    let uri = await audioRecorderPlayer.startRecorder(path, audioSet);
    audioRecorderPlayer.addRecordBackListener(e => {
      console.log(e);
      console.log(e.currentPosition);
      console.log(audioRecorderPlayer.mmssss(Math.floor(e.currentPosition)));
      // this.setState({
      //   recordSecs: e.current_position,
      //   recordTime: this.audioRecorderPlayer.mmssss(
      //     Math.floor(e.current_position),
      //   ),
      // });
    });
    console.log(`uri: ${uri}`);
  };

  const onStopRecord = async () => {
    let result = await audioRecorderPlayer.stopRecorder();
    audioRecorderPlayer.removeRecordBackListener();
    console.log(result);
    uploadAudio(result);
  };

  const uploadAudio = async fileLocalPath => {
    if (fileLocalPath) {
      const filename = fileLocalPath.substring(
        fileLocalPath.lastIndexOf('/') + 1,
      );
      const uploadUri =
        Platform.OS === 'ios'
          ? fileLocalPath.replace('file:////', '')
          : fileLocalPath;
      const task = storage()
        .ref(`tytyty/audios/${filename}`)
        .putFile(uploadUri);
      task.on('state_changed', snapshot => {});
      try {
        task
          .then(() => {
            Alert.alert(
              'Audio uploaded!',
              'Your audio has been uploaded to Firebase Cloud Storage!',
            );

            storage()
              .ref(`tytyty/audios/${filename}`)
              .getDownloadURL()
              .then(downloadUrl => {
                console.log(downloadUrl, 'DDDDDDDDDDDDDDDDDDDDDDDDDDDD');
              });

            console.log('audio uploaded to the bucket!');
          })
          .catch(e => {
            alert(`${e} EEEEEE`);
          });
      } catch (e) {
        console.error(e);
      }
    }
  };

  const onStartPlay = async e => {
    const path =
      'https://firebasestorage.googleapis.com/v0/b/ioschattestthenremove.appspot.com/o/tytyty%2Faudios%2F1651065823683audio.mp3?alt=media&token=0caa38a2-bf88-4ec1-bc0e-8e914eced4e5';
    const msg = await audioRecorderPlayer.startPlayer(path);
    audioRecorderPlayer.setVolume(1.0);
    audioRecorderPlayer.addPlayBackListener(e => {
      if (e.current_position === e.duration) {
        console.log('finished');
        audioRecorderPlayer.stopPlayer();
      }
      console.log(e, 'PlayTime');
      // this.setState({
      //   currentPositionSec: e.current_position,
      //   currentDurationSec: e.duration,
      //   playTime: this.audioRecorderPlayer.mmssss(
      //     Math.floor(e.current_position),
      //   ),
      //   duration: this.audioRecorderPlayer.mmssss(Math.floor(e.duration)),
      // });
    });
  };

  return (
    <View style={styles.container}>
      {/* <Image
        style={{width: 150, height: 150}}
        source={{
          uri: 'file:///data/user/0/com.rnchatfirestoreapp/cache/thumbnails/thumb-9138c0aa-1c56-4262-9ceb-0917be3e9eba',
        }}
      />
      <Button
        title="record start"
        onPress={() => {
          onStartRecord();
        }}
      />
      <Button
        title="record stop"
        onPress={() => {
          onStopRecord();
        }}
      />
      <Button
        title="play"
        onPress={() => {
          onStartPlay();
        }}
      />
      <Button title="stop" onPress={() => {}} /> */}

      {/* <Button
        title="Press Button"
        onPress={() => {
          selectImage();
        }}
      />
      <Video
        ref={ref => (videoPlayer.current = ref)}
        // source={videoData}
        source={{
          uri: 'https://firebasestorage.googleapis.com/v0/b/rnchatapptest-f7453.appspot.com/o/test.mp4?alt=media&token=d1df08dd-e42c-4282-bceb-8b8a1f29ca8c',
        }}
        resizeMode={'contain'}
        paused={false}
        repeat={true}
        style={{
          width: 200,
          height: 200,
          top: 0,
          left: 0,
          bottom: 0,
          right: 0,
        }}
      /> */}
      {/* <View style={styles.imageContainer}>
        <TouchableOpacity style={styles.selectButton} onPress={selectImage}>
          <Text style={styles.buttonText}>Pick an image</Text>
        </TouchableOpacity>

        {image !== null ? (
          <Image source={{uri: image}} style={styles.imageBox} />
        ) : null}
        {uploading ? (
          <View style={styles.progressBarContainer}>
            <Progress.Bar progress={transferred} width={300} />
          </View>
        ) : (
          <TouchableOpacity style={styles.uploadButton} onPress={uploadImage}>
            <Text style={styles.buttonText}>Upload image</Text>
          </TouchableOpacity>
        )}
      </View> */}

      <FlatList
        data={threads}
        keyExtractor={item => item._id}
        ItemSeparatorComponent={() => <Divider />}
        renderItem={({item}) => (
          <TouchableOpacity
            onPress={() => navigation.navigate('Room', {thread: item})}>
            <List.Item
              title={item.name}
              description={item.latestMessage.text}
              titleNumberOfLines={1}
              titleStyle={styles.listTitle}
              descriptionStyle={styles.listDescription}
              descriptionNumberOfLines={1}
            />
          </TouchableOpacity>
        )}
      />
    </View>
  );
}
export default HomeScreen;

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f5f5f5',
    flex: 1,
  },
  listTitle: {
    fontSize: 22,
  },
  listDescription: {
    fontSize: 16,
  },
  selectButton: {
    borderRadius: 5,
    width: 150,
    height: 50,
    backgroundColor: '#8ac6d1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadButton: {
    borderRadius: 5,
    width: 150,
    height: 50,
    backgroundColor: '#ffb6b9',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  imageContainer: {
    marginTop: 30,
    marginBottom: 50,
    alignItems: 'center',
  },
  progressBarContainer: {
    marginTop: 20,
  },
  imageBox: {
    width: 300,
    height: 300,
  },
});
