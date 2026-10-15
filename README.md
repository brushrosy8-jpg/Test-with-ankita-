# Test with Ankita — ऑनलाइन परीक्षा प्लेटफार्म

यह एक पूर्ण, सुरक्षित और मोबाइल-फ्रेंडली ऑनलाइन परीक्षा प्रणाली है जिसे विशेष रूप से एंड्रॉइड मोबाइल फोन और बिना कोडिंग ज्ञान वाले उपयोगकर्ताओं के लिए बनाया गया है।

---

## 📦 ज़िप डाउनलोड और एक्सट्रैक्ट करना
1. दिए गए लिंक से **exam-saathi-complete.zip** डाउनलोड करें।
2. अपने फोन में ZArchiver या किसी अन्य फ़ाइल मैनेजर ऐप का उपयोग करके ज़िप को एक्सट्रैक्ट (Extract) करें। आपको `exam-saathi` नामक फ़ोल्डर मिलेगा।

---

## 🚀 GitHub पर अपलोड कैसे करें (बिना लैपटॉप के)
1. [GitHub.com](https://github.com) पर अपने मोबाइल ब्राउज़र से लॉगिन करें (डेस्कटॉप साइट मोड चालू करें)।
2. एक नया **Repository** बनाएं (उदाहरण के लिए: `test-with-ankita`, इसे Public रखें)।
3. 'uploading an existing file' विकल्प चुनें।
4. एक्सट्रैक्ट किए गए फ़ोल्डर के अंदर की सभी फ़ाइलों (`package.json`, `server.js`, `render.yaml`, `public/`, `data/`) को चुनकर अपलोड करें।
   * *ध्यान दें:* फ़ोल्डर की संरचना (Folder Structure) सही होनी चाहिए। `package.json` सबसे बाहर (Root directory) होना चाहिए।
5. **Commit changes** पर क्लिक करें।

---

## 🌐 Render पर डिप्लॉय (Deploy) कैसे करें
1. [Render.com](https://render.com) पर जाएं और अपने GitHub खाते से मुफ्त (Free) लॉगिन करें।
2. **New +** बटन पर क्लिक करके **Web Service** चुनें।
3. अपने रिपॉजिटरी को कनेक्ट (Connect) करें।
4. सेटिंग्स भरें:
   * **Name:** test-with-ankita
   * **Root Directory:** (खाली छोड़ दें या `.` रखें)
   * **Environment:** Node
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
   * **Plan Type:** Free
5. **Advanced / Environment Variables** में निम्नलिखित जोड़ें:
   * `ADMIN_USERNAME` = `admin`
   * `ADMIN_PASSWORD` = `securepassword123` (अपनी पसंद का पासवर्ड रखें)
   * `SESSION_SECRET` = `randomsecretkey123`
6. **Create Web Service** पर क्लिक करें। कुछ मिनटों में आपकी वेबसाइट लाइव हो जाएगी!

---

## 📚 उपयोग कैसे करें
* **विद्यार्थी (Students):** वेबसाइट खोलें, अपना नाम और पासवर्ड दर्ज करके रजिस्टर/लॉगिन करें। 'All Tests' में जाकर मॉक टेस्ट दें। टाइमर समाप्त होने पर टेस्ट स्वतः जमा (Auto-submit) हो जाएगा।
* **एडमिन (Admin):** `/admin-login.html` पर जाएं और एडमिन क्रेडेंशियल्स से लॉगिन करके टेस्ट बनाएं, प्रश्न जोड़ें और परिणाम (CSV) डाउनलोड करें।
