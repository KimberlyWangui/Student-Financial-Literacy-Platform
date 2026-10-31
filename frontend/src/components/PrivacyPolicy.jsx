import { Link } from 'react-router-dom';

const PrivacyPolicy = () => (
  <main style={{ maxWidth: 760, margin: '0 auto', padding: '32px 20px', lineHeight: 1.6 }}>
    <h1>PennyWise Privacy Policy</h1>
    <p>Last updated: 31 October 2026</p>

    <p>
      PennyWise is a financial literacy tool for Kenyan university students. This page explains what
      we collect, why, and what you can do about it.
    </p>

    <h2>What we collect</h2>
    <ul>
      <li>Your account details: name, email address and the profile answers you give us.</li>
      <li>If you sign in with Google: your name, email address and Google account ID. Nothing else.</li>
      <li>If you upload an M-Pesa statement: for each transaction, the date and time, the amount, the type,
        whether money went in or out, and your balance afterwards. For who you paid, we keep only a scrambled
        code and the public till or paybill number.</li>
      <li>The simulations you save and the feedback you give on recommendations.</li>
    </ul>

    <h2>What we do not keep</h2>
    <ul>
      <li>The statement PDF itself. It is read once and then discarded.</li>
      <li>Your statement password. It is used once to open the file and is never saved.</li>
      <li>Your name or phone number as printed on the statement, and the names and numbers of the people
        you sent money to or received money from.</li>
    </ul>

    <h2>How we use it</h2>
    <p>
      Only to show you where your money goes and to give you suggestions inside PennyWise. We do not sell
      your data and we do not use it for advertising.
    </p>

    <h2>Services that help us run PennyWise</h2>
    <ul>
      <li>Google, for the Sign in with Google option.</li>
      <li>Brevo, to send emails such as verification codes.</li>
      <li>Render, Vercel and Aiven, which host our website, our services and our database.</li>
    </ul>

    <h2>Your choices</h2>
    <ul>
      <li>You can delete all the statement data we hold for you at any time with the &ldquo;Delete my
        statement data&rdquo; button on the Recommendations page.</li>
      <li>You can ask us to delete your account by emailing us at the address below.</li>
      <li>You can use PennyWise without uploading a statement.</li>
    </ul>

    <h2>Contact</h2>
    <p>Questions or requests: kimberly.wangui@strathmore.edu</p>

    <p><Link to="/">Back to PennyWise</Link></p>
  </main>
);

export default PrivacyPolicy;