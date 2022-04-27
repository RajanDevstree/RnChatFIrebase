import React, {useState, useContext, useEffect, memo} from 'react';
import {
  GiftedChat,
  Bubble,
  Send,
  SystemMessage,
} from 'react-native-gifted-chat';
import {
  ActivityIndicator,
  View,
  StyleSheet,
  TouchableOpacity,
  Text,
  Platform,
  Alert,
  PermissionsAndroid,
  Image,
  Modal,
  Dimensions,
} from 'react-native';
import Toast from 'react-native-simple-toast';

import {IconButton} from 'react-native-paper';
import {AuthContext} from '../navigation/AuthProvider';
import firestore from '@react-native-firebase/firestore';
import useStatsBar from '../utils/useStatusBar';
import {Menu} from 'react-native-paper';
import {Appbar} from 'react-native-paper';

import {launchCamera, launchImageLibrary} from 'react-native-image-picker';
import storage from '@react-native-firebase/storage';
import * as Progress from 'react-native-progress';
import Video from 'react-native-video';
import {createThumbnail} from 'react-native-create-thumbnail';

import Foundation from 'react-native-vector-icons/Foundation';
import Ionicons from 'react-native-vector-icons/Ionicons';
import AudioRecorderPlayer, {
  AVEncoderAudioQualityIOSType,
  AVEncodingOption,
  AudioEncoderAndroidType,
  AudioSet,
  AudioSourceAndroidType,
} from 'react-native-audio-recorder-player';
import RNFetchBlob from 'rn-fetch-blob';

const audioRecorderPlayer = new AudioRecorderPlayer();

function RoomScreen({route, navigation}) {
  useStatsBar('light-content');
  const videoPlayer = React.useRef();
  audioRecorderPlayer.setSubscriptionDuration(0.09);

  const [messages, setMessages] = useState([]);
  const [sendFolder, setSendFolder] = useState(false);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);
  const [videoModal, setVideoModal] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(null);
  const [playSoundState, setPlaySoundState] = useState(false);

  const {thread} = route.params;
  const {user} = useContext(AuthContext);
  const currentUser = user.toJSON();

  async function handleSend(
    messages,
    isImage = false,
    imageVideoUrl = '',
    isVideo = false,
    isAudio = false,
  ) {
    debugger;
    const text = isImage ? '' : messages[0].text;

    let MessageObj = {
      text: isImage || isVideo || isAudio ? '' : text,
      createdAt: new Date().getTime(),
      user: {
        _id: currentUser.uid,
        email: currentUser.email,
      },
    };

    if (isImage) {
      MessageObj['image'] = imageVideoUrl;
    }
    if (isAudio) {
      MessageObj['audio'] = imageVideoUrl;
    }

    if (isVideo) {
      MessageObj['video'] = imageVideoUrl;
      MessageObj['videoThumbnail'] = isVideo;
    }

    firestore()
      .collection('THREADS')
      .doc(thread._id)
      .collection('MESSAGES')
      .add(MessageObj);

    await firestore()
      .collection('THREADS')
      .doc(thread._id)
      .set(
        {
          latestMessage: {
            text: isImage || isVideo || isAudio ? 'Document Upload' : text,
            createdAt: new Date().getTime(),
          },
        },
        {merge: true},
      );
  }

  useEffect(() => {
    const messagesListener = firestore()
      .collection('THREADS')
      .doc(thread._id)
      .collection('MESSAGES')
      .orderBy('createdAt', 'desc')
      .onSnapshot(querySnapshot => {
        const messages = querySnapshot.docs.map(doc => {
          const firebaseData = doc.data();

          const data = {
            _id: doc.id,
            text: '',
            createdAt: new Date().getTime(),
            ...firebaseData,
          };

          if (!firebaseData.system) {
            data.user = {
              ...firebaseData.user,
              name: firebaseData.user.email,
            };
          }

          return data;
        });

        setMessages(messages);
      });

    // Stop listening for updates whenever the component unmounts
    return () => messagesListener();
  }, []);

  // useEffect(() => {
  //   if (!recording && recordingTime) {
  //     onStopRecord();
  //   }
  // }, [recording, recordingTime]);

  const selectImage = () => {
    setSendFolder(false);
    const options = {
      maxWidth: 2000,
      maxHeight: 2000,
      storageOptions: {
        skipBackup: true,
        path: 'images',
      },
    };
    launchImageLibrary(options, response => {
      if (response.didCancel) {
        console.log('User cancelled image picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
      } else {
        console.log(response);
        console.log(response['assets'][0].uri);
        setImage(response['assets'][0].uri);
        uploadImage(response['assets'][0].uri);
      }
    });
  };

  const tackAPhoto = async () => {
    try {
      const granted = await PermissionsAndroid.request(
        PermissionsAndroid.PERMISSIONS.CAMERA,
        {
          title: 'App Camera Permission',
          message: 'App needs access to your camera ',
        },
      );
      if (granted === PermissionsAndroid.RESULTS.GRANTED) {
        setSendFolder(false);
        console.log('TACK A PHOTO IMAGES');
        let options = {
          storageOptions: {
            skipBackup: true,
            path: 'images',
          },
        };
        launchCamera(options, response => {
          console.log('Response = ', response);

          if (response.didCancel) {
            console.log('User cancelled image picker');
          } else if (response.error) {
            console.log('ImagePicker Error: ', response.error);
          } else if (response.customButton) {
            console.log('User tapped custom button: ', response.customButton);
            alert(response.customButton);
          } else {
            setImage(response['assets'][0].uri);
            uploadImage(response['assets'][0].uri);
          }
        });
      } else {
        console.log('Camera permission denied');
      }
    } catch (err) {
      console.warn(err);
    }
  };

  const uploadImage = async imageData => {
    if (imageData) {
      const filename = imageData.substring(imageData.lastIndexOf('/') + 1);
      const uploadUri =
        Platform.OS === 'ios' ? imageData.replace('file://', '') : imageData;
      setUploading(true);
      setTransferred(0);
      const task = storage()
        .ref(`${route.params.thread.name}/images/${filename}`)
        .putFile(uploadUri);
      task.on('state_changed', snapshot => {
        setTransferred(
          Math.round(snapshot.bytesTransferred / snapshot.totalBytes) * 10000,
        );
      });
      try {
        task
          .then(() => {
            Alert.alert(
              'Photo uploaded!',
              'Your photo has been uploaded to Firebase Cloud Storage!',
            );

            storage()
              .ref(`${route.params.thread.name}/images/${filename}`)
              .getDownloadURL()
              .then(downloadUrl => {
                handleSend(messages, true, downloadUrl, false, false);
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
      setUploading(false);
      setImage(null);
    }
  };

  const getAVideo = () => {
    setSendFolder(false);

    const options = {
      mediaType: 'video',
      videoQuality: 'high',
    };
    launchImageLibrary(options, response => {
      if (response.didCancel) {
        console.log('User cancelled Video picker');
      } else if (response.error) {
        console.log('ImagePicker Error: ', response.error);
      } else if (response.customButton) {
        console.log('User tapped custom button: ', response.customButton);
      } else {
        console.log(response['assets'][0].uri);
        createThumbnail({
          url: response['assets'][0].uri,
          timeStamp: 10000,
        })
          .then(responseData => {
            console.log(responseData, 'RRRRROOM VIDEO IMAGE');
            uploadVideoToFirestore(
              response['assets'][0].uri,
              responseData.path,
            );
          })
          .catch(err => {
            console.log(err, 'ROOM VIDEO IMAGE ERROR ERROR ERROR');
            uploadVideoToFirestore(
              response['assets'][0].uri,
              'https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRJVTwzb0qgP1sWqpXpqUSCHJ6ldaB1kHzYUQ&usqp=CAU',
            );
          });

        // uploadVideoToFirestore(response['assets'][0].uri);
      }
    });
  };

  const uploadVideoToFirestore = async (VideoData, thumbnaiDeviceUrl) => {
    if (VideoData) {
      const filename =
        VideoData.substring(VideoData.lastIndexOf('/') + 1) +
        new Date().getTime() +
        '';
      const uploadUri =
        Platform.OS === 'ios' ? VideoData.replace('file://', '') : VideoData;
      const task = storage()
        .ref(`${route.params.thread.name}/videos/${filename}`)
        .putFile(uploadUri);

      console.log(VideoData, filename, uploadUri);
      task.on('state_changed', snapshot => {});
      try {
        task
          .then(() => {
            // Alert.alert(
            //   'Video uploaded!',
            //   'Your Video has been uploaded to Firebase Cloud Storage!',
            // );

            storage()
              .ref(`${route.params.thread.name}/videos/${filename}`)
              .getDownloadURL()
              .then(downloadUrl => {
                if (!thumbnaiDeviceUrl.includes('https://')) {
                  const thumbnailFileName =
                    thumbnaiDeviceUrl.substring(
                      thumbnaiDeviceUrl.lastIndexOf('/') + 1,
                    ) +
                    new Date().getTime() +
                    '';
                  const thumbnailUploadUri =
                    Platform.OS === 'ios'
                      ? thumbnaiDeviceUrl.replace('file://', '')
                      : thumbnaiDeviceUrl;
                  const taskThubnail = storage()
                    .ref(
                      `${route.params.thread.name}/images/${thumbnailFileName}`,
                    )
                    .putFile(thumbnailUploadUri);

                  taskThubnail.on('state_changed', snapshot => {});

                  var downalodVideoFirebaseUrl = downloadUrl;
                  taskThubnail
                    .then(() => {
                      Alert.alert(
                        'Video and Video Thumbnail uploaded!',
                        'Your Video and Video Thumbnail has been uploaded to Firebase Cloud Storage!',
                      );

                      storage()
                        .ref(
                          `${route.params.thread.name}/images/${thumbnailFileName}`,
                        )
                        .getDownloadURL()
                        .then(thumbnailImage => {
                          handleSend(
                            messages,
                            false,
                            downalodVideoFirebaseUrl,
                            thumbnailImage,
                            false,
                          );
                          console.log(
                            messages,
                            false,
                            downalodVideoFirebaseUrl,
                            thumbnailImage,
                            'ERERERERERERERERERERERE=================================',
                          );
                        });
                    })
                    .catch(e => {
                      alert(`${e} EEEEEE`);
                    });
                }

                // console.log(downloadUrl, 'DDDDDDDDDDDDDDDDDDDDDDDDDDDD');
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
      console.log(
        typeof audioRecorderPlayer.mmssss(Math.floor(e.currentPosition)),
      );
      setRecordingTime(
        audioRecorderPlayer.mmssss(Math.floor(e.currentPosition)),
      );

      // if (!recording) {
      //   onStopRecord();
      // }

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
    console.log(result, '1234567890');
    console.log('REACAORD DOING STOP IT');
    if (result.includes('com.rnchatfirestoreapp')) {
      uploadAudio(result);
    }
  };

  const uploadAudio = async fileLocalPathAudio => {
    if (fileLocalPathAudio) {
      const filename = fileLocalPathAudio.substring(
        fileLocalPathAudio.lastIndexOf('/') + 1,
      );
      const uploadUri =
        Platform.OS === 'ios'
          ? fileLocalPathAudio.replace('file:////', '')
          : fileLocalPathAudio;
      const task = storage()
        .ref(`${route.params.thread.name}/audios/${filename}`)
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
              .ref(`${route.params.thread.name}/audios/${filename}`)
              .getDownloadURL()
              .then(downloadUrl => {
                handleSend(messages, false, downloadUrl, false, true);
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

  const onStartPlay = async audioUrl => {
    const path = audioUrl;
    const msg = await audioRecorderPlayer.startPlayer(path);
    audioRecorderPlayer.setVolume(1.0);
    audioRecorderPlayer.addPlayBackListener(e => {
      console.log(e, 'Audio playingset et');
      if (e.currentPosition == e.duration) {
        console.log('finished');
        audioRecorderPlayer.stopPlayer();
        setPlaySoundState(false);
        setRecordingTime(null);
      }
      console.log(
        audioRecorderPlayer.mmssss(Math.floor(e.duration)),
        'PlayTime',
      );
      setRecordingTime(
        audioRecorderPlayer.mmssss(Math.floor(e.currentPosition)),
      );
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

  function renderBubble(props) {
    return (
      <Bubble
        {...props}
        wrapperStyle={{
          right: {
            backgroundColor: '#0d9eff',
          },
        }}
        textStyle={{
          right: {
            color: '#fff',
          },
        }}
      />
    );
  }

  function renderLoading() {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0d9eff" />
      </View>
    );
  }

  function renderSend(props) {
    return (
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
        <TouchableOpacity
          onPress={() => {
            Toast.show('Hold to record and release to send', Toast.LONG);
          }}
          onPressOut={() => {
            console.log('ENDED');
            if (recording) {
              setRecording(false);
              setRecordingTime(null);
              onStopRecord();

              // send to the request to audio send to the server side:
            }
          }}
          onLongPress={() => {
            // setTimeout(() => {
            setRecording(true);
            onStartRecord();
            // setTimeout(() => {
            //   onStopRecord();
            // }, 3000);
            console.log('STARTED LONG PRESS');
            // }, 1000);
          }}
          style={{
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            left: -40,
            // top: 0.001,
            // bottom: 0.0001,
            position: 'absolute',
          }}>
          <IconButton icon="microphone" size={28} color="#0d9eff" />
        </TouchableOpacity>

        <Send {...props}>
          <View style={styles.sendingContainer}>
            <View
              style={{
                alignSelf: 'center',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <IconButton icon="send-circle" size={32} color="#0d9eff" />
            </View>
          </View>
        </Send>
      </View>
    );
  }

  function scrollToBottomComponent() {
    return (
      <View style={styles.bottomComponentContainer}>
        <IconButton icon="chevron-double-down" size={36} color="#0d9eff" />
      </View>
    );
  }

  function renderSystemMessage(props) {
    return (
      <SystemMessage
        {...props}
        wrapperStyle={styles.systemMessageWrapper}
        textStyle={styles.systemMessageText}
      />
    );
  }

  const MyComponent = () => (
    <View
      style={{
        justifyContent: 'center',
        marginVertical: 5,
        alignItems: 'center',
        width: '100%',
      }}>
      <Menu.Item
        icon="camera"
        onPress={() => {
          tackAPhoto();
        }}
        title="Camera"
      />
      <Menu.Item
        icon="image-multiple"
        onPress={() => {
          selectImage();
        }}
        title="Image Upload"
      />
      <Menu.Item
        icon="video"
        onPress={() => {
          getAVideo();
        }}
        title="Video Upload"
      />
      <Menu.Item
        icon="close"
        onPress={() => {
          setSendFolder(false);
        }}
        title="Close Modal"
      />
    </View>
  );

  const renderMessageAudio = props => {
    return (
      <TouchableOpacity
        onPress={() => {
          if (!playSoundState) {
            console.log(props.currentMessage.audio, 'Audio url Playing');
            setPlaySoundState(true);
            onStartPlay(props.currentMessage.audio);
          }
        }}
        style={{alignSelf: 'center', marginTop: 5}}>
        <Ionicons
          name="play-circle"
          color={playSoundState ? '#fab619' : '#DDDDDD'}
          size={30}
          style={{
            // position: 'absolute',
            // left: 135 / 2,
            // top: 65 / 2,
            zIndex: 100,
          }}
        />
      </TouchableOpacity>
    );
  };

  const renderMessageVideo = props => {
    return (
      <TouchableOpacity
        onPress={() => {
          setVideoModal(props.currentMessage.video);
        }}
        style={{
          height: 100,
          width: 150,
          alignSelf: 'center',
        }}>
        <Foundation
          name="play-video"
          color="#DDDDDD"
          size={30}
          style={{
            position: 'absolute',
            left: 135 / 2,
            top: 65 / 2,
            zIndex: 100,
          }}
        />
        <Image
          style={{
            width: '100%',
            height: '100%',
            resizeMode: 'contain',
            borderTopLeftRadius: 10,
            borderTopRightRadius: 10,
          }}
          source={{uri: props.currentMessage.videoThumbnail}}
        />
      </TouchableOpacity>
    );
  };

  // console.log(messages, 'message');

  return (
    <>
      <Appbar.Header style={{backgroundColor: '#0d9eff'}}>
        <Appbar.BackAction
          onPress={() => {
            navigation.goBack();
          }}
        />
        <Appbar.Content title={route.params.thread.name} />

        <Appbar.Action
          icon="file-send"
          onPress={() => {
            setSendFolder(true);
          }}
        />
      </Appbar.Header>
      {recording || playSoundState ? (
        <View
          style={{
            justifyContent: 'center',
            marginVertical: 5,
            alignItems: 'center',
            width: '100%',
          }}>
          <Menu.Item
            icon="microphone-settings"
            onPress={() => {
              // tackAPhoto();
            }}
            title={`${
              recording ? 'recording' : playSoundState ? 'audio playing' : ''
            } ${recordingTime ? recordingTime : ''}`}
          />
        </View>
      ) : null}
      {videoModal ? (
        <Modal transparent={true} visible={true} onRequestClose={() => {}}>
          <View
            style={{
              flex: 1,
              flexDirection: 'column',
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: 'rgba(0, 0, 0, 0.7),',
            }}>
            <Ionicons
              name="close"
              color="#FFFFFF"
              size={30}
              style={{
                position: 'absolute',
                left: '87%',
                top: 40,
                zIndex: 100,
              }}
              onPress={() => {
                setVideoModal(false);
              }}
            />

            <View
              style={{
                width: Dimensions.get('window').width,
                height: 300,
                backgroundColor: '#000000',
                // width: 300,
                // height: 300,
              }}>
              <Video
                style={{
                  // position: 'absolute',
                  left: 0,
                  top: 0,
                  width: Dimensions.get('window').width,
                  height: 300,
                  // borderRadius: 10,
                }}
                resizeMode={'cover'}
                paused={false}
                repeat={true}
                muted={true}
                source={{
                  uri: videoModal,
                }}
              />
            </View>
          </View>
        </Modal>
      ) : null}

      <GiftedChat
        messages={messages}
        onSend={handleSend}
        user={{_id: currentUser.uid}}
        placeholder="Type your message here..."
        alwaysShowSend
        showUserAvatar
        scrollToBottom
        renderBubble={renderBubble}
        renderLoading={renderLoading}
        renderSend={renderSend}
        scrollToBottomComponent={scrollToBottomComponent}
        renderSystemMessage={renderSystemMessage}
        renderMessageVideo={renderMessageVideo}
        renderMessageAudio={renderMessageAudio}
      />
      {sendFolder ? <MyComponent /> : false}
    </>
  );
}

export default memo(RoomScreen);

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendingContainer: {
    // justifyContent: 'center',
    // alignItems: 'center',
    // flexDirection: 'row',
  },
  bottomComponentContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  systemMessageWrapper: {
    backgroundColor: '#0d9eff',
    borderRadius: 4,
    padding: 5,
  },
  systemMessageText: {
    fontSize: 14,
    color: '#fff',
    fontWeight: 'bold',
  },
});
