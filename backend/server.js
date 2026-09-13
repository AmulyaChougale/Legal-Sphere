require('dotenv').config();

const express = require('express');
const nodemailer = require('nodemailer');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const multer = require('multer');
const session = require('express-session');
const crypto = require('crypto');
const flash = require('connect-flash');
const passport = require('passport');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;

app.use(express.static('public'));
// app.use(express.static('uploads'));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(cors());


// =====================================================
// CONNECT TO MONGODB
// =====================================================

// mongoose.connect('mongodb://127.0.0.1:27017/legalServiceRegistration', {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
// });
//MongoDB Atlas connection
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('Connected to MongoDB Atlas'))
    .catch(err => console.error('MongoDB connection error:', err));


// =====================================================
// LEGAL SERVICE SCHEMA
// =====================================================

const legalServiceSchema = new mongoose.Schema({

    // Common fields
    serviceType: String,
    name: String,
    address: String,
    experienceInYears: Number,
    languages: String,
    about: String,
    phone: String,
    email: String,

    // Advocate fields
    fieldOfExpertise: String,
    enrollment: String,
    courts: String,

    // Notary fields
    notaryRegistrationNumber: String,
    jurisdiction: String,
    notarialServices: String,

    // Document Writer fields
    documentWriterRegistrationNumber: String,
    documentWriterSpecialization: String,
    documentWritingExperience: String,

    // Common database fields
    isVerified: Boolean,
    documents: String,
    image: String
});


// Create LegalService model
const LegalService = mongoose.model(
    'LegalService',
    legalServiceSchema
);


// =====================================================
// USER SCHEMA
// =====================================================

const userSchema = new mongoose.Schema({

    username: String,
    contact: String,
    email: String,
    password: String,
    verificationToken: String,

    isVerified: {
        type: Boolean,
        default: false
    }

});

const User = mongoose.model(
    'Users',
    userSchema
);


// =====================================================
// HOME CONTACT SCHEMA
// =====================================================

const homeContactSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        trim: true
    },

    email: {
        type: String,
        required: true,
        trim: true
    },

    subject: {
        type: String,
        required: true,
        trim: true
    },

    message: {
        type: String,
        required: true,
        trim: true
    },

    createdAt: {
        type: Date,
        default: Date.now
    }

});

const HomeContact = mongoose.model(
    'HomeContact',
    homeContactSchema
);


// =====================================================
// FILE UPLOAD CONFIGURATION
// =====================================================

const storage = multer.diskStorage({

    destination: (req, file, cb) => {

        cb(null, 'uploads/');

    },

    filename: (req, file, cb) => {

        cb(
            null,
            Date.now() + '-' + file.originalname
        );

    }

});

const upload = multer({
    storage: storage
});


// =====================================================
// MIDDLEWARE
// =====================================================

app.use(
    bodyParser.urlencoded({
        extended: true
    })
);


// =====================================================
// EMAIL TRANSPORTER
// =====================================================

const transporter = nodemailer.createTransport({

    service: 'gmail',

    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }

});


// =====================================================
// PAGE ROUTES
// =====================================================

// Lawyer details
app.get('/lawyerDetails', (req, res) => {

    res.sendFile(
        __dirname + '/public/lawyerDetails.html'
    );

});


// Notary details
app.get('/notaryDetails', (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            'public',
            'notarydetail.html'
        )
    );

});


// Document Writer details
app.get('/documentWriterDetails', (req, res) => {

    res.sendFile(
        path.join(
            __dirname,
            'public',
            'documentwriterdetail.html'
        )
    );

});


// Registration
app.get('/registration', (req, res) => {

    res.sendFile(
        __dirname + '/public/service_registration.html'
    );

});


// Feedback
app.get('/feedback', (req, res) => {

    res.sendFile(
        __dirname + '/public/feedback_form.html'
    );

});


// =====================================================
// FEEDBACK
// =====================================================

// Handle feedback form submission
app.post('/submit_feedback', (req, res) => {

    const {
        name,
        email,
        feedback
    } = req.body;


    const mailOptions = {

        from: process.env.EMAIL_USER,

        to: email,

        bcc: process.env.EMAIL_USER,

        subject: 'Feedback Received',

        text: `Dear ${name},

Thank you for your feedback! We have received the following message:

${feedback}

Best regards,
The Feedback Team`

    };


    transporter.sendMail(
        mailOptions,
        (error, info) => {

            if (error) {

                console.error(error);

                res.send(
                    'Error sending confirmation email, please check your internet connection.'
                );

            } else {

                console.log(
                    'Email sent: ' + info.response
                );

                res.send(
                    'Feedback submitted successfully. You will receive a confirmation email.'
                );

            }

        }
    );

});


// =====================================================
// HOME CONTACT
// =====================================================

// Handle home page CTA form submission
app.post('/home_contact', async (req, res) => {

    try {

        const {
            name,
            email,
            subject,
            message
        } = req.body;


        // -------------------------------------------------
        // Validate required fields
        // -------------------------------------------------

        if (
            !name ||
            !email ||
            !subject ||
            !message
        ) {

            return res.status(400).send(
                'All fields are required.'
            );

        }


        // -------------------------------------------------
        // Save CTA response to MongoDB
        // -------------------------------------------------

        const homeContact = new HomeContact({

            name: name,

            email: email,

            subject: subject,

            message: message

        });


        await homeContact.save();


        console.log(
            'Home contact saved successfully:',
            homeContact._id
        );


        // -------------------------------------------------
        // Send confirmation email
        // -------------------------------------------------

        const mailOptions = {

            from: process.env.EMAIL_USER,

            to: email,

            bcc: process.env.EMAIL_USER,

            subject: 'Message Received @ Legal Service',

            text: `Dear ${name},

Thank you for contacting us!

We have received your message.

Subject: ${subject}

Message:
${message}

Our team will get back to you if required.

Best regards,
The Legal Service Team`

        };


        transporter.sendMail(
            mailOptions,
            (error, info) => {

                if (error) {

                    console.error(
                        'Email error:',
                        error
                    );

                    /*
                     * The response has already been
                     * stored in MongoDB.
                     *
                     * Therefore, the user's submission
                     * is not lost even if email fails.
                     */

                    return res.send(
                        'Message submitted successfully.'
                    );

                }


                console.log(
                    'Email sent: ' + info.response
                );


                res.send(
                    'Message sent successfully. You will receive a confirmation email.'
                );

            }
        );


    } catch (error) {

        console.error(
            'Home contact error:',
            error
        );


        res.status(500).send(
            'Internal Server Error: ' +
            error.message
        );

    }

});


// =====================================================
// CONTACT / INQUIRY
// =====================================================

// Handle contact form submission
app.post('/submit-inquiry', (req, res) => {

    const {
        name,
        contactNo,
        email,
        city,
        reason,
        lawyerId
    } = req.body;


    try {

        LegalService.findOne({
            _id: lawyerId
        }).then((lawyer) => {

            if (lawyer) {


                const mailOptions = {

                    from: process.env.EMAIL_USER,

                    to: email,

                    bcc: process.env.EMAIL_USER,

                    subject: 'Inquiry Received @ Legal Service',

                    text: `Dear ${name},

Thank you for contacting us! We have received following inquiry from you:

Reason: ${reason}
City: ${city}
Email: ${email}
Contact: ${contactNo}
Lawer Name: ${lawyer.name}

The Contact number of the lawyer you request for is:
Lawyer contact number: ${lawyer.phone}

Best regards,
The Legal Service Team`

                };


                const mailOptions2 = {

                    from: process.env.EMAIL_USER,

                    to: `${lawyer.email}`,

                    bcc: process.env.EMAIL_USER,

                    subject: 'Inquiry Received @ Legal Service',

                    text: `Dear ${lawyer.name},

We have recieved a following inquery on your profile:

Name: ${name}
City: ${city}
Email: ${email}
Contact: ${contactNo}
Reason: ${reason}

Thank for being onboard on the legal service platform

Best regards,
The Legal Service Team`

                };


                transporter.sendMail(
                    mailOptions,
                    (error, info) => {

                        if (error) {

                            console.error(error);

                            res.send(
                                'Error sending confirmation email, please check your internet connection.'
                            );

                        } else {

                            console.log(
                                'Email sent: ' +
                                info.response
                            );

                            res.send(
                                'Inquiry submitted successfully. You will receive a confirmation email.'
                            );

                        }

                    }
                );


                transporter.sendMail(
                    mailOptions2,
                    (error, info) => {

                        if (error) {

                            console.error(error);

                            res.send(
                                'Error sending confirmation email, please check your internet connection.'
                            );

                        } else {

                            console.log(
                                'Email sent: ' +
                                info.response
                            );

                            res.send(
                                'Inquiry submitted successfully. You will receive a confirmation email.'
                            );

                        }

                    }
                );


            } else {

                res.status(400).send(
                    'lawyer not found'
                );

            }

        });


    } catch (error) {

        console.error(error);

        res.status(500).send(
            'Internal Server Error: ' +
            error.message
        );

    }

});


// =====================================================
// COMMON PROVIDER REGISTRATION
// ADVOCATE / NOTARY / DOCUMENT WRITER
// =====================================================

app.post(

    '/register',

    upload.fields([
        {
            name: 'documents'
        },
        {
            name: 'image'
        }
    ]),

    async (req, res) => {

        try {

            const {

                // Common fields
                serviceType,
                name,
                address,
                experienceInYears,
                languages,
                phone,
                email,
                about,

                // Advocate fields
                fieldOfExpertise,
                enrollment,
                courts,

                // Notary fields
                notaryRegistrationNumber,
                jurisdiction,
                notarialServices,

                // Document Writer fields
                documentWriterRegistrationNumber,
                documentWriterSpecialization,
                documentWritingExperience

            } = req.body;


            // Uploaded image
            const image =
                req.files['image'][0].filename;


            // Uploaded document
            const documents =
                req.files['documents'][0].filename;


            // Create LegalService instance
            const legalService = new LegalService({

                // Common fields
                serviceType,
                name,
                address,
                experienceInYears,
                languages,
                phone,
                email,
                about,

                // Advocate fields
                fieldOfExpertise,
                enrollment,
                courts,

                // Notary fields
                notaryRegistrationNumber,
                jurisdiction,
                notarialServices,

                // Document Writer fields
                documentWriterRegistrationNumber,
                documentWriterSpecialization,
                documentWritingExperience,

                // Verification and files
                isVerified: false,
                documents,
                image

            });


            // Save registration data
            await legalService.save();


            res.send(
                'Registration successful'
            );


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Internal Server Error: ' +
                error.message
            );

        }

    }

);


// =====================================================
// ADMIN - PENDING PROVIDERS
// =====================================================

app.get(
    '/admin/pending-providers',
    async (req, res) => {

        try {

            const providers =
                await LegalService.find({
                    isVerified: false
                });


            res.json(providers);


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Error loading pending providers'
            );

        }

    }
);


// =====================================================
// ADMIN - APPROVE PROVIDER
// =====================================================

app.put(
    '/admin/approve-provider/:id',
    async (req, res) => {

        try {

            const provider =
                await LegalService.findByIdAndUpdate(

                    req.params.id,

                    {
                        isVerified: true
                    },

                    {
                        new: true
                    }

                );


            if (!provider) {

                return res.status(404).send(
                    'Provider not found'
                );

            }


            res.send(
                'Provider approved successfully'
            );


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Error approving provider'
            );

        }

    }
);


// =====================================================
// ADVOCATES
// =====================================================

app.get(
    '/get-lawyers',
    async (req, res) => {

        try {

            const lawyers =
                await LegalService.find({

                    serviceType: 'advocate',

                    isVerified: true

                });


            res.send(lawyers);


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Internal Server Error: ' +
                error.message
            );

        }

    }
);


// =====================================================
// SINGLE ADVOCATE
// =====================================================

app.get(
    '/get-lawyer',
    async (req, res) => {

        try {

            const {
                lawyerId
            } = req.query;


            const lawyer =
                await LegalService.findOne({

                    _id: lawyerId,

                    serviceType: 'advocate',

                    isVerified: true

                });


            if (lawyer) {

                res.send(lawyer);

            } else {

                res.status(400).send(
                    'lawyer not found'
                );

            }


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Internal Server Error: ' +
                error.message
            );

        }

    }
);


// =====================================================
// NOTARIES
// =====================================================

app.get(
    '/get-notaries',
    async (req, res) => {

        try {

            const notaries =
                await LegalService.find({

                    serviceType: 'notary',

                    isVerified: true

                });


            console.log(
                'Verified notaries:',
                notaries
            );


            res.json(notaries);


        } catch (error) {

            console.error(
                'Error fetching notaries:',
                error
            );


            res.status(500).json({

                message: 'Server error'

            });

        }

    }
);


// =====================================================
// SINGLE NOTARY
// =====================================================

app.get(
    '/get-notary',
    async (req, res) => {

        try {

            const notary =
                await LegalService.findOne({

                    _id: req.query.notaryId,

                    serviceType: 'notary',

                    isVerified: true

                });


            if (!notary) {

                return res.status(404).json({

                    message: 'Notary not found'

                });

            }


            res.json(notary);


        } catch (error) {

            console.error(
                'Error fetching notary:',
                error
            );


            res.status(500).json({

                message: 'Server error'

            });

        }

    }
);


// =====================================================
// DOCUMENT WRITERS
// =====================================================

app.get(
    '/get-documentwriters',
    async (req, res) => {

        try {

            const documentWriters =
                await LegalService.find({

                    serviceType: 'documentwriter',

                    isVerified: true

                });


            console.log(
                'Verified document writers:',
                documentWriters
            );


            res.send(documentWriters);


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Internal Server Error: ' +
                error.message
            );

        }

    }
);


// =====================================================
// SINGLE DOCUMENT WRITER
// =====================================================

app.get(
    '/get-documentwriter',
    async (req, res) => {

        try {

            const {
                writerId
            } = req.query;


            const writer =
                await LegalService.findOne({

                    _id: writerId,

                    serviceType: 'documentwriter',

                    isVerified: true

                });


            if (writer) {

                res.send(writer);

            } else {

                res.status(400).send(
                    'Document writer not found'
                );

            }


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Internal Server Error: ' +
                error.message
            );

        }

    }
);


// =====================================================
// USER REGISTRATION
// =====================================================

app.post(
    '/user-register',
    async (req, res) => {

        try {

            const {
                username,
                contact,
                email,
                password
            } = req.body;


            // Check username
            const existingUser =
                await User.findOne({
                    username
                });


            if (existingUser) {

                return res.status(400).send(
                    'Username already exists. Please choose a different username.'
                );

            }


            // Check email
            const existingEmail =
                await User.findOne({
                    email
                });


            if (existingEmail) {

                return res.status(400).send(
                    'Email already exists. You may try sign in.'
                );

            }


            // Generate verification token
            const verificationToken =
                crypto
                    .randomBytes(20)
                    .toString('hex');


            const userService = new User({

                username,
                contact,
                email,
                password,
                verificationToken

            });


            // Save user
            await userService.save();


            // Verification link
            const verificationLink =
                `http://localhost:3000/verify-email?token=${verificationToken}`;


            // Verification email
            const mailOptions = {

                from: process.env.EMAIL_USER,

                to: email,

                bcc: process.env.EMAIL_USER,

                subject: 'Email Verification',

                text:
                    `Click on the following link to verify your email: ${verificationLink}`

            };


            transporter.sendMail(

                mailOptions,

                (error, info) => {

                    if (error) {

                        console.error(
                            'Error sending verification email:',
                            error
                        );


                        res.status(500).send(
                            'Error sending verification email'
                        );


                    } else {

                        console.log(
                            'Verification email sent:',
                            info.response
                        );


                        res.send(
                            'Registration successful. Please check your email to verify your account.'
                        );

                    }

                }

            );


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Internal Server Error: ' +
                error.message
            );

        }

    }
);


// =====================================================
// EMAIL VERIFICATION
// =====================================================

app.get(
    '/verify-email',
    async (req, res) => {

        try {

            const {
                token
            } = req.query;


            // Find user
            const user =
                await User.findOne({

                    verificationToken: token

                });


            if (!user) {

                return res.status(400).send(
                    'Invalid or expired verification token'
                );

            }


            // Verify user
            user.isVerified = true;

            user.verificationToken = undefined;


            await user.save();


            res.send(
                'Email verification successful. You can now login.'
            );


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Internal Server Error: ' +
                error.message
            );

        }

    }
);


// =====================================================
// USER LOGIN
// =====================================================

app.post(
    '/user-login',
    async (req, res) => {

        try {

            const {
                username,
                password
            } = req.body;


            User.findOne({

                username: username

            }).then(
                async (user) => {

                    if (user) {


                        // Check email verification
                        if (!user.isVerified) {

                            return res.status(401).send(
                                'Please verify your email before logging in.'
                            );

                        }


                        // Check username
                        if (
                            user.username !== username
                        ) {

                            return res.status(401).send(
                                'Username is incorrect'
                            );

                        }


                        // Check password
                        if (
                            user.password !== password
                        ) {

                            return res.status(401).send(
                                'Password is incorrect'
                            );

                        } else {

                            return res.send(
                                user
                            );

                        }


                    } else {

                        return res.status(401).send(
                            'User not found'
                        );

                    }

                }
            );


        } catch (error) {

            console.error(error);

            res.status(500).send(
                'Internal Server Error: ' +
                error.message
            );

        }

    }
);


// =====================================================
// START SERVER
// =====================================================

app.listen(
    port,
    () => {

        console.log(
            `Server is running at http://localhost:${port}`
        );

    }
);