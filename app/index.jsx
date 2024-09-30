import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, TextInput, Alert, Animated, useColorScheme, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import CustomToggleSwitch from './CustomToggleSwitch'; // Import the custom toggle switch component
import * as ImagePicker from 'expo-image-picker';
import { Camera } from 'expo-camera';
import { Audio } from 'expo-av';
import { Video } from 'expo-av';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import { getDatabase, ref, push, set } from 'firebase/database';
import { storage, database } from '../firebaseConfig';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc } from 'firebase/firestore'; 
import { firestore } from '../firebaseConfig';
import axios from 'axios';

const App = () => {
  const systemColorScheme = useColorScheme();
  const [darkMode, setDarkMode] = useState(systemColorScheme === 'dark');
  const [showOptions, setShowOptions] = useState(false);
  const [selectedEmergency, setSelectedEmergency] = useState('');
  const [mediaUri, setMediaUri] = useState('');
  const [isVideo, setIsVideo] = useState(false);
  const [locationPermission, setLocationPermission] = useState(null);
  const [notificationPermission, setNotificationPermission] = useState(null);
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState(null);
  const [buttonText, setButtonText] = useState('Emergency');
  const [showCancelButton, setShowCancelButton] = useState(false);
  const [cancelTimer, setCancelTimer] = useState(4);
  const [emergencySent, setEmergencySent] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [verificationStep, setVerificationStep] = useState(0); // 0: Phone input, 1: Code input, 2: Personal info

  const [phoneNumber, setPhoneNumber] = useState('');
  const [isPhoneNumberValid, setIsPhoneNumberValid] = useState(true);
  const [verificationCode, setVerificationCode] = useState('');
  const [personalInfo, setPersonalInfo] = useState({
    firstname: '',
    lastname: '',
    email: '',
    phoneNumber: ''
  });
  const [isEmailValid, setIsEmailValid] = useState(true);
  const [profileImageUri, setProfileImageUri] = useState('');
  const [accountCreated, setAccountCreated] = useState(false);
  const [isFormValid, setIsFormValid] = useState(true);

  const pulseAnimation = useRef(new Animated.Value(1)).current;
  const cancelAnimation = useRef(new Animated.Value(0)).current;
  const slideAnimation = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    requestPermissions();
    if (buttonText === 'Waiting for Response') {
      startPulse();
    }
  }, [buttonText]);

  useEffect(() => {
    if (systemColorScheme === 'dark' && !darkMode) {
      setDarkMode(true);
    } else if (systemColorScheme === 'light' && darkMode) {
      setDarkMode(false);
    }
  }, [systemColorScheme]);

  const requestPermissions = async () => {
    try {
      const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(locationStatus === 'granted');
      if (locationStatus !== 'granted') {
        Alert.alert('Permission required', 'Permission to access location is required to use this app.');
      }

      const { status: notificationStatus } = await Notifications.requestPermissionsAsync();
      setNotificationPermission(notificationStatus === 'granted');
      if (notificationStatus !== 'granted') {
        Alert.alert('Permission required', 'Permission to send notifications is required to use this app.');
      }
    } catch (error) {
      console.error("Error requesting permissions:", error);
    }
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnimation, {
          toValue: 1.3,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const handleEmergencyPress = () => {
    setVerificationStep(3); // Simulate navigation to the dashboard
  };

  const handleEmergencyLongPress = () => {
    setShowOptions(!showOptions);
  };

  const handleOptionPress = (option) => {
    setSelectedEmergency(option);
    setShowOptions(false);
  };

  const requestCameraPermissions = async () => {
    const { status } = await Camera.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access camera is required!');
      return false;
    }
    return true;
  };

  const requestMicrophonePermissions = async () => {
    const { status } = await Audio.requestPermissionsAsync();
    if (status !== 'granted') {
      alert('Permission to access microphone is required!');
      return false;
    }
    return true;
  };

  const handleCameraPress = async () => {
    const hasCameraPermissions = await requestCameraPermissions();
    if (!hasCameraPermissions) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 1,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setMediaUri(uri);
      setIsVideo(false);
    }
  };

  const handleCameraLongPress = async () => {
    const hasCameraPermissions = await requestCameraPermissions();
    if (!hasCameraPermissions) return;

    const hasMicrophonePermissions = await requestMicrophonePermissions();
    if (!hasMicrophonePermissions) return;

    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Videos,
      quality: 1,
      videoMaxDuration: 10,
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const uri = result.assets[0].uri;
      setMediaUri(uri);
      setIsVideo(true);
    }
  };

  const initiateEmergencySending = () => {
    setShowCancelButton(true);
    setCancelTimer(4);
    setEmergencySent(false);

    Animated.loop(
      Animated.timing(cancelAnimation, {
        toValue: 1,
        duration: 1000,
        useNativeDriver: false,
      })
    ).start();

    timerRef.current = setInterval(() => {
      setCancelTimer(prev => {
        if (prev === 1) {
          clearInterval(timerRef.current);
          if (!emergencySent) {
            sendEmergencyData();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const sendEmergencyData = async () => {
    try {
      const locationResult = await Location.getCurrentPositionAsync({});
      setLocation(locationResult.coords);

      let mediaDownloadUrl = '';
      if (mediaUri) {
        const response = await fetch(mediaUri);
        const blob = await response.blob();
        const mediaRef = storageRef(storage, `emergencyMedia/${Date.now()}`);
        await uploadBytes(mediaRef, blob);
        mediaDownloadUrl = await getDownloadURL(mediaRef);
      }

      const emergencyRef = ref(database, 'emergencies');
      const newEmergencyRef = push(emergencyRef);

      await set(newEmergencyRef, {
        emergencyType: selectedEmergency,
        description,
        mediaUri: mediaDownloadUrl,
        isVideo,
        location: {
          latitude: locationResult.coords.latitude,
          longitude: locationResult.coords.longitude
        },
        timestamp: new Date().toISOString(),
      });

      setSelectedEmergency('');
      setDescription('');
      setMediaUri('');
      setIsVideo(false);
      setButtonText('Waiting for Response');
      setShowCancelButton(false);
      setEmergencySent(true);
    } catch (error) {
      console.error("Error sending emergency data:", error);
      Alert.alert('Error', 'There was an error sending your emergency data.');
    }
  };

  const handleCancelPress = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    cancelAnimation.setValue(0);
    setShowCancelButton(false);
    setButtonText('Emergency');
    setEmergencySent(false);
    setSelectedEmergency('');
    setDescription('');
    setMediaUri('');
    setIsVideo(false);
    setShowOptions(false);
  };

  const toggleDarkMode = () => {
    setDarkMode(!darkMode);
  };

  const openSettings = () => {
    setSettingsVisible(true);
    Animated.timing(slideAnimation, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  };

  const closeSettings = () => {
    Animated.timing(slideAnimation, {
      toValue: 0,
      duration: 300,
      useNativeDriver: true,
    }).start(() => setSettingsVisible(false));
  };

  const handleHomePress = () => {
    if (buttonText !== 'Waiting for Response' && !showCancelButton) {
      setSelectedEmergency('');
      setDescription('');
      setMediaUri('');
      setIsVideo(false);
      setShowOptions(false);
      setShowCancelButton(false);
      setButtonText('Emergency');
    }
  };

  const slideUpStyle = {
    transform: [
      {
        translateY: slideAnimation.interpolate({
          inputRange: [0, 1],
          outputRange: [500, 0],
        }),
      },
    ],
  };

  const validateEmail = (email) => {
    // Basic email validation regex
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePhoneNumber = (number) => {
    // Basic phone number validation for 10 digits
    const phoneRegex = /^\d{10}$/;
    return phoneRegex.test(number);
  };

  const handleEmailSubmit = async () => {
    if (!validateEmail(personalInfo.email)) {
      setIsEmailValid(false);
      return;
    }
  
    try {
      const response = await axios.post('http://192.168.1.105:8000/api/send-verification-code', {
        email: personalInfo.email,
      });
  
      if (response.status === 200) {
        setVerificationStep(1);
        Alert.alert('Success', 'A verification code has been sent to your email.');
      } else {
        Alert.alert('Error', response.data.message);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to send verification code.');
    }
  };
  
  
  

  const handlePhoneSubmit = () => {
    if (!validatePhoneNumber(phoneNumber)) {
      setIsPhoneNumberValid(false);
    } else {
      setIsPhoneNumberValid(true);
      setVerificationStep(1);
    }
  };

  const handleCodeSubmit = async () => {
    try {
      const response = await axios.post('http://192.168.1.105:8000/api/verify-code', {
        email: personalInfo.email,
        verification_code: verificationCode,
      });
  
      if (response.status === 200) {
        setVerificationStep(2);
        Alert.alert('Success', 'Email verified successfully.');
      } else {
        Alert.alert('Error', response.data.message);
      }
    } catch (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to verify the code.');
    }
  };
  
  

  const handlePersonalInfoSubmit = async () => {
    const isPhoneValid = validatePhoneNumber(personalInfo.phoneNumber);
    const isEmailValid = validateEmail(personalInfo.email);
  
    if (!personalInfo.firstname || !personalInfo.lastname || !isPhoneValid || !isEmailValid) {
      setIsFormValid(false);
      setIsPhoneNumberValid(isPhoneValid);
      setIsEmailValid(isEmailValid);
      return;
    }
  
    setIsFormValid(true);
    setIsPhoneNumberValid(true);
    setIsEmailValid(true);
  
    try {
      const personalInfoWithImage = {
        ...personalInfo,
        profileImageUri,
      };
  
      const docRef = await addDoc(collection(firestore, 'personalInfo'), personalInfoWithImage);
      console.log('Personal info added with ID:', docRef.id);
  
      setAccountCreated(true);
    } catch (error) {
      console.error('Error adding personal information: ', error);
      Alert.alert('Error', 'There was an error saving your personal information.');
    }
  };
  

  const handleProfileImageUpload = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [4, 3],
      quality: 1,
    });

    if (!result.canceled) {
      setProfileImageUri(result.assets[0].uri);
    }
  };

  const styles = createStyles(darkMode);

  if (locationPermission === null || notificationPermission === null) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Requesting permissions...</Text>
      </View>
    );
  }

  if (!locationPermission || !notificationPermission) {
    return (
      <View style={styles.container}>
        <Text style={styles.permissionText}>Permissions are required to use the app.</Text>
      </View>
    );
  }

  const animatedCancelStyle = {
    borderWidth: 5,
    borderColor: cancelAnimation.interpolate({
      inputRange: [0, 1],
      outputRange: ['red', 'transparent'],
    }),
    borderLeftColor: 'red',
    transform: [{
      rotate: cancelAnimation.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '360deg'],
      }),
    }],
  };

  const pulseStyle = {
    transform: [{ scale: pulseAnimation }],
    opacity: pulseAnimation.interpolate({
      inputRange: [1, 1.3],
      outputRange: [2, 0],
    }),
  };

  if (verificationStep === 0) {
    return (
      <View style={styles.container}>
        <View style={styles.verificationContainer}>
          <Ionicons name="mail-outline" size={80} color="red" style={styles.verificationIcon} />
          <Text style={styles.verificationText}>Please take a moment to verify your email address</Text>
          <Text style={styles.verificationSubText}>This helps us confirm your identity and secure your data.</Text>
          <View style={styles.emailInputContainer}>
            <TextInput
              style={[styles.emailInput, !isEmailValid && { borderColor: 'red', borderWidth: 1 }]}
              placeholder="Enter your email address"
              keyboardType="email-address"
              value={personalInfo.email}
              onChangeText={(text) => setPersonalInfo({ ...personalInfo, email: text })}
            />
          </View>
          {!isEmailValid && (
            <Text style={styles.errorText}>Please enter a valid email address.</Text>
          )}
          <TouchableOpacity style={styles.submitButton} onPress={handleEmailSubmit}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }
  
  

  if (verificationStep === 1) {
    return (
      <View style={styles.container}>
        <View style={styles.verificationContainer}>
          <Ionicons name="chatbubble-outline" size={80} color="red" style={styles.verificationIcon} />
          <Text style={styles.verificationTitle}>Verification Code</Text>
          <Text style={styles.verificationText}>Please type the verification code sent to +63**********</Text>
          <View style={styles.codeInputContainer}>
            {[...Array(6)].map((_, index) => (
              <TextInput
                key={index}
                style={styles.codeInput}
                keyboardType="number-pad"
                maxLength={1}
                value={verificationCode[index] || ''}
                onChangeText={(text) => {
                  const newCode = verificationCode.split('');
                  newCode[index] = text;
                  setVerificationCode(newCode.join(''));
                }}
              />
            ))}
          </View>
          <TouchableOpacity style={styles.submitButton} onPress={handleCodeSubmit}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (verificationStep === 2) {
    return (
      <View style={styles.container}>
        <View style={styles.verificationContainer}>
          <Text style={styles.verificationTitle}>Personal Information</Text>
          <Text style={styles.verificationText}>This will serve as your in case of emergency details. Please fill up all the required fields.</Text>
          <TouchableOpacity style={styles.uploadButton} onPress={handleProfileImageUpload}>
            <Text style={styles.uploadButtonText}>Upload Profile Image</Text>
          </TouchableOpacity>
          {profileImageUri ? (
            <Image source={{ uri: profileImageUri }} style={styles.profileImagePreview} />
          ) : null}
          <TextInput
            style={[styles.input, !isFormValid && !personalInfo.firstname && { borderColor: 'red', borderWidth: 1 }]}
            placeholder="Firstname"
            value={personalInfo.firstname}
            onChangeText={(text) => setPersonalInfo({ ...personalInfo, firstname: text })}
          />
          <TextInput
            style={[styles.input, !isFormValid && !personalInfo.lastname && { borderColor: 'red', borderWidth: 1 }]}
            placeholder="Lastname"
            value={personalInfo.lastname}
            onChangeText={(text) => setPersonalInfo({ ...personalInfo, lastname: text })}
          />
          <TextInput
            style={[styles.input, !isFormValid && !personalInfo.email && !isEmailValid && { borderColor: 'red', borderWidth: 1 }]}
            placeholder="Email"
            value={personalInfo.email}
            onChangeText={(text) => setPersonalInfo({ ...personalInfo, email: text })}
          />
          <TextInput
            style={[styles.input, !isFormValid && !personalInfo.phoneNumber && !isPhoneNumberValid && { borderColor: 'red', borderWidth: 1 }]}
            placeholder="Phone Number"
            value={personalInfo.phoneNumber}
            onChangeText={(text) => setPersonalInfo({ ...personalInfo, phoneNumber: text })}
          />
          {!isFormValid && (
            <Text style={styles.errorText}>Please fill in all the fields correctly.</Text>
          )}
          <TouchableOpacity style={styles.submitButton} onPress={handlePersonalInfoSubmit}>
            <Text style={styles.submitButtonText}>Submit</Text>
          </TouchableOpacity>
        </View>
        <Modal
          visible={accountCreated}
          transparent={true}
          animationType="slide"
        >
          <View style={styles.popupContainer}>
            <View style={styles.popup}>
              <Text style={styles.popupText}>Account successfully created!</Text>
              <TouchableOpacity
                style={styles.popupButton}
                onPress={() => {
                  setAccountCreated(false);
                  setVerificationStep(3); // Proceed to the dashboard
                }}
              >
                <Text style={styles.popupButtonText}>OK</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.profileContainer}>
        <Image source={require('../assets/images/avatar.png')} style={styles.profileImage} />

          <Text style={styles.name}>Juan Dela Cruz</Text>
          <Text style={styles.phone}>+63**********</Text>
        </View>
      </View>
      <View style={styles.body}>
        {!selectedEmergency && (
          <View style={styles.emergencyButtonContainer}>
            {buttonText === 'Waiting for Response' && (
              <Animated.View style={[styles.pulse, pulseStyle]} />
            )}
            {!showCancelButton && (
              <TouchableOpacity
                style={styles.emergencyButton}
                onPress={handleEmergencyPress}
                onLongPress={handleEmergencyLongPress}
                disabled={buttonText === 'Waiting for Response'}
              >
                <Text style={styles.emergencyText}>{buttonText}</Text>
              </TouchableOpacity>
            )}
          </View>
        )}
        {showOptions && (
          <>
            <TouchableOpacity style={[styles.optionButton, styles.floodButton, styles.topLeft]} onPress={() => handleOptionPress('Flood')}>
              <Text style={styles.optionText}>Flood</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, styles.fireButton, styles.topRight]} onPress={() => handleOptionPress('Fire')}>
              <Text style={styles.optionText}>Fire</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, styles.medicalButton, styles.bottomLeft]} onPress={() => handleOptionPress('Medical')}>
              <Text style={styles.optionText}>Medical</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.optionButton, styles.othersButton, styles.bottomRight]} onPress={() => handleOptionPress('Others')}>
              <Text style={styles.optionText}>Others</Text>
            </TouchableOpacity>
          </>
        )}
        {selectedEmergency && !showCancelButton && (
          <View style={styles.emergencyDetails}>
            <View style={styles.emergencyRow}>
              <Text style={styles.emergencyLabel}>Emergency: {selectedEmergency}</Text>
              <TouchableOpacity
                style={styles.cameraButton}
                onPress={handleCameraPress}
                onLongPress={handleCameraLongPress}
              >
                <Ionicons name="camera-outline" size={24} color="black" />
              </TouchableOpacity>
            </View>
            <View style={styles.textInputContainer}>
              <TextInput
                style={styles.textInput}
                placeholder="Describe your emergency"
                placeholderTextColor="gray"
                multiline
                value={description}
                onChangeText={setDescription}
              />
              {mediaUri ? (
                <View style={styles.mediaPreviewContainer}>
                  {isVideo ? (
                    <Video
                      source={{ uri: mediaUri }}
                      style={styles.mediaPreview}
                      useNativeControls
                      resizeMode="contain"
                      isLooping
                    />
                  ) : (
                    <Image
                      source={{ uri: mediaUri }}
                      style={styles.mediaPreview}
                    />
                  )}
                  <TouchableOpacity onPress={() => setMediaUri('')}>
                    <Ionicons name="close-circle-outline" size={24} color="black" />
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>
            <Text style={styles.infoText}>This message will be sent to your c/mdrrmo response team</Text>
            <TouchableOpacity style={styles.sendButton} onPress={initiateEmergencySending}>
              <Text style={styles.sendButtonText}>Send</Text>
            </TouchableOpacity>
          </View>
        )}
        {showCancelButton && (
          <View style={styles.cancelContainer}>
            <TouchableOpacity style={styles.cancelButton} onPress={handleCancelPress}>
              <Animated.View style={[styles.cancelCircle, animatedCancelStyle]}>
                <Ionicons name="close" size={36} color="red" />
              </Animated.View>
            </TouchableOpacity>
            <Text style={styles.sendingText}>Sending in {cancelTimer}...</Text>
          </View>
        )}
      </View>
      <View style={styles.footer}>
        <TouchableOpacity style={styles.footerButton} onPress={handleHomePress} disabled={buttonText === 'Waiting for Response' || showCancelButton}>
          <Ionicons name="home-outline" size={24} color={buttonText === 'Waiting for Response' || showCancelButton ? 'gray' : 'white'} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton}>
          <Ionicons name="call-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton}>
          <Ionicons name="location-outline" size={24} color="white" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.footerButton} onPress={openSettings}>
          <Ionicons name="settings-outline" size={24} color="white" />
        </TouchableOpacity>
      </View>
      
      {settingsVisible && (
        <Modal
          visible={settingsVisible}
          animationType="none"
          transparent={true}
          onRequestClose={closeSettings}
        >
          <View style={styles.settingsContainer}>
            <Animated.View style={[styles.settingsContent, slideUpStyle]}>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Account</Text>
                <TouchableOpacity onPress={() => Alert.alert('Edit Profile')}>
                  <Text style={styles.editProfileText}>Edit Profile</Text>
                </TouchableOpacity>
              </View>
              <View style={styles.settingItem}>
                <Text style={styles.settingText}>Dark Mode</Text>
                <CustomToggleSwitch value={darkMode} onValueChange={toggleDarkMode} />
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={closeSettings}>
                <Text style={styles.closeButtonText}>Close</Text>
              </TouchableOpacity>
            </Animated.View>
          </View>
        </Modal>
      )}
    </View>
  );
};

const createStyles = (darkMode) => StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'space-between',
    backgroundColor: darkMode ? 'black' : 'white',
  },
  header: {
    alignItems: 'center',
    marginTop: 50,
  },
  profileContainer: {
    alignItems: 'center',
  },
  profileImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  name: {
    fontSize: 20,
    fontWeight: 'bold',
    color: darkMode ? 'white' : 'black',
    marginTop: 10,
  },
  phone: {
    fontSize: 16,
    color: 'gray',
  },
  body: {
    alignItems: 'center',
    position: 'relative',
    flex: 1,
    justifyContent: 'center',
  },
  emergencyButtonContainer: {
    position: 'relative',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emergencyButton: {
    backgroundColor: 'red',
    borderRadius: 60,
    width: 120,
    height: 120,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'absolute',
    zIndex: 1,
  },
  pulse: {
    backgroundColor: 'rgba(255,0,0,0.5)',
    borderRadius: 60,
    width: 120,
    height: 120,
    position: 'absolute',
    zIndex: 0,
  },
  emergencyText: {
    color: 'white',
    fontSize: 18,
    fontWeight: 'bold',
  },
  optionButton: {
    position: 'absolute',
    borderRadius: 20,
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 0,
  },
  floodButton: {
    backgroundColor: '#4a90e2',
  },
  fireButton: {
    backgroundColor: '#d0021b',
  },
  medicalButton: {
    backgroundColor: '#7ed321',
  },
  othersButton: {
    backgroundColor: '#9b9b9b',
  },
  optionText: {
    fontSize: 16,
    color: 'white',
    fontWeight: 'bold',
    textAlign: 'center',
  },
  topLeft: {
    top: '29%',
    left: '21%',
  },
  topRight: {
    top: '29%',
    right: '21%',
  },
  bottomLeft: {
    bottom: '29%',
    left: '21%',
  },
  bottomRight: {
    bottom: '29%',
    right: '21%',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingBottom: 20,
    backgroundColor: '#1a1a1a',
    paddingTop: 10,
  },
  footerButton: {
    alignItems: 'center',
  },
  emergencyDetails: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: darkMode ? '#333' : '#d3d3d3',
    padding: 10,
    borderRadius: 10,
    width: '90%',
  },
  emergencyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    width: '100%',
  },
  emergencyLabel: {
    fontSize: 18,
    fontWeight: 'bold',
    color: darkMode ? 'white' : 'black',
    flex: 1,
  },
  textInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'gray',
    borderRadius: 5,
    padding: 10,
    width: '100%',
    marginBottom: 10,
  },
  textInput: {
    flex: 1,
    textAlignVertical: 'top',
    color: darkMode ? 'white' : 'black',
  },
  cameraButton: {
    marginLeft: 10,
  },
  infoText: {
    fontSize: 12,
    color: 'gray',
    marginBottom: 10,
    textAlign: 'center',
  },
  sendButton: {
    backgroundColor: 'blue',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 5,
  },
  sendButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  mediaPreview: {
    width: 80,
    height: 80,
  },
  mediaPreviewContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: 10,
  },
  permissionText: {
    color: darkMode ? 'white' : 'black',
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginTop: '50%',
  },
  cancelContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
  },
  cancelButton: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 5,
    borderColor: 'transparent',
    borderLeftColor: 'red',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendingText: {
    color: darkMode ? 'white' : 'black',
    fontSize: 16,
    marginTop: 10,
  },
  settingsContainer: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  settingsContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    alignItems: 'center',
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    marginBottom: 15,
  },
  settingText: {
    fontSize: 18,
    color: 'black',
  },
  editProfileText: {
    fontSize: 16,
    color: 'blue',
  },
  closeButton: {
    marginTop: 10,
  },
  closeButtonText: {
    color: 'blue',
    fontSize: 16,
  },
  verificationContainer: {
    alignItems: 'center',
    marginTop: 50,
    paddingHorizontal: 20,
  },
  verificationIcon: {
    marginBottom: 20,
  },
  verificationText: {
    fontSize: 16,
    textAlign: 'center',
    color: darkMode ? 'white' : 'black',
    marginVertical: 10,
  },
  verificationSubText: {
    fontSize: 14,
    textAlign: 'center',
    color: 'gray',
    marginVertical: 10,
  },
  phoneInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  phoneInputCode: {
    backgroundColor: 'lightgray',
    borderRadius: 5,
    padding: 10,
    marginRight: 10,
    width: 50,
    textAlign: 'center',
  },
  phoneInput: {
    flex: 1,
    backgroundColor: 'lightgray',
    borderRadius: 5,
    padding: 10,
  },
  codeInputContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginVertical: 20,
  },
  codeInput: {
    backgroundColor: 'lightgray',
    borderRadius: 5,
    padding: 10,
    margin: 5,
    textAlign: 'center',
    width: 45,
  },
  verificationTitle: {
    color: "red",
    fontSize: 20,
  },
  input: {
    backgroundColor: 'lightgray',
    borderRadius: 5,
    padding: 10,
    marginVertical: 10,
    width: '90%',
  },
  submitButton: {
    backgroundColor: 'red',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 20,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  uploadButton: {
    backgroundColor: 'blue',
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginVertical: 10,
  },
  uploadButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  profileImagePreview: {
    width: 100,
    height: 100,
    borderRadius: 50,
    marginVertical: 10,
  },
  popupContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  popup: {
    width: 300,
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 20,
    alignItems: 'center',
  },
  popupText: {
    fontSize: 16,
    marginBottom: 20,
  },
  popupButton: {
    backgroundColor: 'blue',
    padding: 10,
    borderRadius: 5,
  },
  popupButtonText: {
    color: 'white',
    fontSize: 16,
  },
  emailInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  emailInput: {
    flex: 1,
    backgroundColor: 'lightgray',
    borderRadius: 5,
    padding: 10,
  },
  errorText: {
    color: 'red',
    fontSize: 14,
    marginTop: 5,
  },
});

export default App;
