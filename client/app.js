// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyCuQDhbDvyx7jqi4j3taUXmEo00AidP5rA",
    authDomain: "carrental-134c4.firebaseapp.com",
    projectId: "carrental-134c4",
    storageBucket: "carrental-134c4.firebasestorage.app",
    messagingSenderId: "708807600531",
    appId: "1:708807600531:web:0af6b2865d16acf62b2066",
    measurementId: "G-8VLL5LH62K"
  };
  
  firebase.initializeApp(firebaseConfig);
  
  let confirmationResult;
  
  function sendOTP() {
    const mobileNumber = document.getElementById('mobile').value;
    const appVerifier = new firebase.auth.RecaptchaVerifier('recaptcha-container', {
      size: 'invisible',
    });
  
    firebase.auth().signInWithPhoneNumber(mobileNumber, appVerifier)
      .then(result => {
        confirmationResult = result;
        alert('OTP sent successfully!');
      })
      .catch(error => {
        alert('Error sending OTP: ' + error.message);
      });
  }
  
  function verifyOTP() {
    const otp = document.getElementById('otp').value;
  
    confirmationResult.confirm(otp)
      .then(result => {
        const user = result.user;
  
        user.getIdToken()
          .then(idToken => {
            fetch('http://localhost:3000/api/users/verify-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idToken })
            })
            .then(response => response.json())
            .then(data => {
              if (data.token) {
                alert('User verified successfully! JWT: ' + data.token);
              } else {
                alert('Verification failed!');
              }
            });
          });
      })
      .catch(error => {
        alert('Error verifying OTP: ' + error.message);
      });
  }
  