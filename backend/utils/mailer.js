const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

async function sendPasswordLink(email, link) {
  const mailOptions = {
    from: `"Feedback System" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: "Définir votre mot de passe",
    html: `
      <p>Bonjour,</p>
      <p>Veuillez définir votre mot de passe en cliquant sur le lien suivant :</p>
      <a href="${link}">${link}</a>
      <p>Ce lien est valable pendant 24 heures.</p>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    return { success: true };
  } catch (error) {
    console.error("Erreur envoi email :", error);
    return { success: false, error };
  }
}

module.exports = { sendPasswordLink };
