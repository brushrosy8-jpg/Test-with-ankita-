# Test with Ankita — ऑनलाइन परीक्षा प्लेटफार्म

यह एक पूर्ण, सुरक्षित और मोबाइल-फ्रेंडली ऑनलाइन परीक्षा प्रणाली है जिसे विशेष रूप से एंड्रॉइड मोबाइल फोन और बिना कोडिंग ज्ञान वाले उपयोगकर्ताओं के लिए बनाया गया है। इसमें गणित, रीजनिंग और हिंदी विषयों के लिए अलग-अलग सेक्शन और लीडरबोर्ड उपलब्ध हैं।

---

## 📦 ज़िप डाउनलोड और एक्सट्रैक्ट करना
1. दिए गए लिंक से **test-with-ankita-complete.zip** डाउनलोड करें।
2. अपने फोन में ZArchiver या किसी अन्य फ़ाइल मैनेजर ऐप का उपयोग करके ज़िप को एक्सट्रैक्ट (Extract) करें। आपको `test-with-ankita` फ़ोल्डर मिलेगा।

---

## 🚀 GitHub पर अपलोड कैसे करें (बिना लैपटॉप के)
1. [GitHub.com](https://github.com) पर अपने मोबाइल ब्राउज़र से लॉगिन करें (डेस्कटॉप साइट मोड चालू करें)।
2. एक नया **Repository** बनाएं (उदाहरण के लिए: `test-with-ankita`, इसे Public रखें)।
3. 'uploading an existing file' विकल्प चुनें।
4. एक्सट्रैक्ट किए गए फ़ोल्डर के अंदर की सभी फ़ाइलों को चुनकर अपलोड करें। `package.json` सबसे बाहर (Root directory) होना चाहिए।
5. **Commit changes** पर क्लिक करें।

---

## 🌐 Render पर डिप्लॉय (Deploy) कैसे करें
1. [Render.com](https://render.com) पर जाएं और अपने GitHub खाते से मुफ्त (Free) लॉगिन करें।
2. **New +** बटन पर क्लिक करके **Web Service** चुनें और अपनी रिपॉजिटरी कनेक्ट करें।
3. सेटिंग्स भरें:
   * **Name:** test-with-ankita
   * **Environment:** Node
   * **Build Command:** `npm install`
   * **Start Command:** `npm start`
   * **Plan Type:** Free
4. **Advanced / Environment Variables** में जोड़ें:
   * `ADMIN_USERNAME` = `admin`
   * `ADMIN_PASSWORD` = `securepassword123`
   * `SESSION_SECRET` = `randomsecretkey123`
5. **Create Web Service** पर क्लिक करें!

---

## 📚 विशेषताएं
* **विषय-वार सेक्शन:** गणित (Maths), रीजनिंग (Reasoning), और हिंदी (Hindi)।
* **लीडरबोर्ड:** ओवरऑल, सब्जेक्ट-वाइज और टेस्ट-वाइज रैंकिंग (Gold, Silver, Bronze हाइलाइट्स के साथ)।
* **ZIP इम्पोर्टर:** एडमिन पैनल के माध्यम से मॉक टेस्ट ZIP (जिसमें `questions.json` हो) अपलोड करें।
