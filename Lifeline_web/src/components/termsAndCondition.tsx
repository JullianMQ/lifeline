import "../styles/termsConditions.css";

type TermsConditionProps = {
  status: boolean;
  setStatus: React.Dispatch<React.SetStateAction<boolean>>;
  onClose?: () => void;
};

export default function TermsCondition({
  status,
  setStatus,
  onClose,
}: TermsConditionProps) {
  return (
    <>
        <article className="TCcontent">
            <section className="head">
                <h1>TERMS AND CONDITIONS</h1>
                <img src="/images/close.svg" alt="Back" onClick={onClose} className=""/>
            </section>

            <section className="body">

            <div>
                <p><strong>Last Updated:</strong> February 2026</p>
                <p>
                Welcome to Lifeline. By accessing or using the Lifeline, you agree to be
                bound by these Terms and Conditions. If you do not agree with any part
                of these Terms, please do not use the App.
                </p>
            </div>

            <div>
                <h2>ABOUT LIFELINE</h2>
                <p>
                Lifeline is a support and assistance application designed to help users
                notify their chosen emergency contacts when unusual or potentially
                dangerous situations are detected. The App uses device sensors such as
                the accelerometer, gyroscope, microphone, GPS, and camera to detect
                anomalies like erratic or sudden movements.
                </p>
                <p>
                Lifeline is available through a mobile application and a web-based
                dashboard and is developed and operated in the Philippines.
                </p>
            </div>

            <div>
                <h2>ELIGIBILITY</h2>
                <p>
                Lifeline is intended for users 18 years old and above. Minors may use
                the App only with the consent and supervision of a parent or legal
                guardian.
                </p>
            </div>

            <div>
                <h2>USER ACCOUNTS</h2>
                <p>To use Lifeline, users must create an account. The App collects the following information:</p>
                <ul>
                <li>Name</li>
                <li>Email address</li>
                <li>Phone number</li>
                <li>Profile photo (optional; default avatars are provided)</li>
                <li>Real-time location data</li>
                <li>Photo, video, and audio recordings</li>
                </ul>
                <p>
                Users may be assigned different roles, such as mutual or dependent,
                which determine how the App functions for them.
                </p>
            </div>

            <div>
                <h2>PURPOSE AND LIMITATIONS</h2>
                <p>
                Lifeline is a support and assistance tool only. It does not replace
                emergency services such as police, ambulance, or medical responders.
                </p>
            </div>

            <div>
                <h2>LOCATION AND EMERGENCY FEATURES</h2>
                <p>
                Lifeline may track real-time location and share recordings with
                emergency contacts when anomalies are detected.
                </p>
            </div>

            <div>
                <h2>USER RESPONSIBILITIES</h2>
                <p>
                Users agree to use the App responsibly and understand that emergency
                contacts are the primary responders.
                </p>
            </div>

            <div>
                <h2>DATA AND PRIVACY</h2>
                <p>
                Lifeline processes user data only for its intended functionality and
                does not sell user data.
                </p>
            </div>

            <div>
                <h2>ACCOUNT SUSPENSION AND TERMINATION</h2>
                <p>
                The Lifeline team may suspend or terminate accounts for misuse.
                </p>
            </div>

            <div>
                <h2>LIABILITY AND DISCLAIMERS</h2>
                <p>
                Lifeline is provided “as is” and users agree to use the App at their
                own risk.
                </p>
            </div>

            <div>
                <h2>INTELLECTUAL PROPERTY</h2>
                <p>Lifeline is a school capstone project developed by the Lifeline team.</p>
            </div>

            <div>
                <h2>UPDATES AND CHANGES</h2>
                <p>
                Users will be notified of changes via email.
                </p>
            </div>

            <div>
                <h2>GOVERNING LAW</h2>
                <p>
                These Terms are governed by the laws of the Republic of the Philippines.
                </p>
            </div>

            <div>
                <h2>CONTACT INFORMATION</h2>
                <p>
                For questions, contact the Lifeline development team.
                </p>
            </div>

            </section>

            <footer>
            <label htmlFor="terms-checkbox" className="termsConditions">
                <input type="checkbox" checked={status} onChange={(e) => setStatus(e.target.checked)}/>
                <p>I have read and agree to the Terms and Conditions.</p>
            </label>

            {onClose && (
                <button type="button" onClick={onClose} disabled={!status} className="pos-btn">
                Done
                </button>
            )}
            </footer>
        </article>
    </>
  );
}
