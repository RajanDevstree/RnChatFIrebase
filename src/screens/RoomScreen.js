import React, {useState, useContext, useEffect} from 'react';
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
} from 'react-native';

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

export default function RoomScreen({route, navigation}) {
  useStatsBar('light-content');
  const videoPlayer = React.useRef();

  const [messages, setMessages] = useState([]);
  const [sendFolder, setSendFolder] = useState(false);
  const [image, setImage] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [transferred, setTransferred] = useState(0);

  const {thread} = route.params;
  const {user} = useContext(AuthContext);
  const currentUser = user.toJSON();

  async function handleSend(
    messages,
    isImage = false,
    imageVideoUrl = '',
    isVideo = false,
  ) {
    debugger;
    const text = isImage ? '' : messages[0].text;

    let MessageObj = {
      text: isImage || isVideo ? '' : text,
      createdAt: new Date().getTime(),
      user: {
        _id: currentUser.uid,
        email: currentUser.email,
      },
    };

    if (isImage) {
      MessageObj['image'] = imageVideoUrl;
    }

    if (isVideo) {
      MessageObj['video'] = imageVideoUrl;
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
            text: isImage || isVideo ? 'Document Upload' : text,
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
                handleSend(messages, true, downloadUrl, false);
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
        uploadVideoToFirestore(response['assets'][0].uri);
      }
    });
  };

  const uploadVideoToFirestore = async VideoData => {
    if (VideoData) {
      const filename =
        VideoData.substring(VideoData.lastIndexOf('/') + 1) +
        new Date().getTime() +
        '';
      const uploadUri =
        Platform.OS === 'ios' ? VideoData.replace('file://', '') : VideoData;
      const task = storage()
        .ref(`${route.params.thread.name}/video/${filename}`)
        .putFile(uploadUri);
      console.log(VideoData, filename, uploadUri);
      task.on('state_changed', snapshot => {});
      try {
        task
          .then(() => {
            Alert.alert(
              'Video uploaded!',
              'Your Video has been uploaded to Firebase Cloud Storage!',
            );

            storage()
              .ref(`${route.params.thread.name}/video/${filename}`)
              .getDownloadURL()
              .then(downloadUrl => {
                handleSend(messages, false, downloadUrl, true);
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
      <Send {...props}>
        <View style={styles.sendingContainer}>
          <View>
            <IconButton icon="send-circle" size={32} color="#0d9eff" />
          </View>
        </View>
      </Send>
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

  const renderMessageVideo = props => {
    console.log(props.currentMessage.video);
    return (
      <View
        style={{
          position: 'relative',
          height: 100,
          width: 150,
          alignSelf: 'center',
        }}>
        <Video
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: 100,
            width: 150,
            borderRadius: 10,
          }}
          resizeMode={'cover'}
          paused={false}
          repeat={true}
          muted={true}
          source={{uri: props.currentMessage.video}}
        />
      </View>
    );
  };

  console.log(messages, 'message');

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
      />
      {sendFolder ? <MyComponent /> : false}
    </>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendingContainer: {
    justifyContent: 'center',
    alignItems: 'center',
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
