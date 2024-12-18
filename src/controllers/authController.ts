import { Response, Request } from "express";
import { log } from "console";
import crypto from "crypto";
import { Agency, IAgency, User, VerificationCode } from "../models/model.js";
import { sendVerificationEmail } from "../middlewares/nodemailer.js";

async function checkAgency(email: String, password: String): Promise<IAgency | null> {

    log(`check -> email : ${email} , password : ${password} `)
    return await Agency.findOne<IAgency>({ email: email });
}

async function checkEmailAndPassword(_req: Request, _res: Response,) {

}

// ? : Create New Agency
export const signUpAgency = async (req: Request, res: Response) => {
    log(`body : ${JSON.stringify(req.body)}`);

    const { email, password } = req.body as IAgency;

    // validation
    const existed = await checkAgency(email, password);

    log(`checkAgency: ${existed}`);

    if (existed != null) {
        return res.status(400).send({
            message: `${email} already exists! Please log in again`,
            error: "error",
            status: 400
        });
    }

    const agency = new Agency(req.body);
    log(`agency : ${JSON.stringify(agency)}`);

    try {
        const savedAgency = await agency.save();
        log(`savedAgency ${JSON.stringify(savedAgency)}`);

        return res.status(201).send({
            message: "success",
            status: 201,
            data: [savedAgency]
        });
    } catch (error) {
        log(`Error: ${error}`);
        return res.status(500).send({
            error: "error",
            status: 500,
            message: `Error ${error}`
        });
    }

}

// ? : Sign In to Agency

export const signInAgency = async (req: Request, res: Response) => {

    const { email, password } = req.body as IAgency;

    try {
        /// validation
        const agency = await checkAgency(email, password);
        if (agency === null) {
            return res.status(404).send({
                message: `${email} Not Found!`,
                error: "error",
                status: 404
            })
        }

        // compare password 

        res.status(200).send({
            message: "success",
            status: 200,
            data: [agency]
        })

    } catch (error) {
        res.status(500).send({
            error: "error",
            status: 500,
            message: "Internal Server Error!"
        })
    }
}

export const signOutAgency = async (req: Request, res: Response) => {

    const { email, password } = req.body as IAgency;

    const agency = await checkAgency(email, password);

    if (agency === null) {
        return res.status(404).send({
            message: `${email} Not Found!`,
            error: "error",
            status: 404
        })
    }

    try {

        const { deletedCount } = await Agency.deleteOne({ email: email });
        if (deletedCount <= 0) {
            return res.status(400).send({
                message: `Failed to SignOut`,
                error: "error",
                status: 400
            })
        }
        res.status(200).send({
            message: `See You Next Time!`,
            error: "success",
            status: 404
        })

    } catch (error) {
        res.status(500).send({
            message: `Failed to SignOut ( Error )`,
            error: "error",
            status: 500
        })
    }

}

export const sendCode = async (req: Request, res: Response) => {
    const { email } = req.body;
    log(`body => email : ${email}`);

    try {
        // // Check if user already exists
        // const existingUser = await User.findOne({ email });
        // if (existingUser) {
        //     return res.status(400).json({ success: false, message: 'Email already registered' });
        // }
        const now = new Date();

        // Check for an existing verification record
        let record = await VerificationCode.findOne({ email });

        if (record) {
            const timeSinceLastSend = (now.getTime() - record.createdAt.getTime()) / (60 * 1000); // Minutes
            const RATE_LIMIT_MINUTES = 5;

            // Enforce rate limiting
            if (timeSinceLastSend < RATE_LIMIT_MINUTES) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${Math.ceil(RATE_LIMIT_MINUTES - timeSinceLastSend)} minute(s) before requesting another code.`,
                });
            }

            // If the code is still valid, reuse it
            if (record.expiredAt.getTime() > now.getTime()) {
                await sendVerificationEmail(email, record.code);
                return res.json({
                    success: true,
                    message: 'Verification code resent successfully.',
                });
            }
        }

        // Generate a new code if no valid code exists
        const newCode = crypto.randomInt(100000, 999999).toString();
        // const newCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit code
        const newExpiration = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes expiration

        if (record) {
            // Update the existing record
            record.code = newCode;
            record.expiredAt = newExpiration;
            record.createdAt = now;
            await record.save();
        } else {
            // Create a new verification record
            record = await VerificationCode.create({
                email,
                code: newCode,
                expiredAt: newExpiration,
                createdAt: now,
            });
        }

        // Send the new code via email
        await sendVerificationEmail(email, newCode);

        res.json({
            success: true,
            message: 'Verification code sent successfully.',
        });

    } catch (error) {
        res.status(500).json({ success: false, message: `Error : ${error}` });
    }
}
export const verifyCode = async (req: Request, res: Response) => {
    const { email, code, name, password } = req.body;

    // Validate the input
    if (!email || !code) {
        return res.status(400).json({ success: false, message: 'Email and code are required.' });
    }
    try {
        // Find the code in the database
        const record = await VerificationCode.findOne({ email, code });

        if (!record) {
            return res.status(400).json({ success: false, message: 'Invalid verification code.' });
        }

        // Check if the code has expired
        if (record?.expiredAt?.getTime() < Date.now()) {
            return res.status(400).json({ success: false, message: 'Verification code has expired.' });
        }

        // Register the user
        const newUser = await User.create({ email, name, password });

        // Delete the verification code record only if the user creation is successful
        // await VerificationCode.deleteOne({ email, code });
        // Return success
        res.json({
            success: true,
            message: 'Verification successful.',
            user: { id: newUser._id, email: newUser.email }, // Expose only necessary fields
        });
    } catch (error) {
        console.error('Error during verification:', error);
        res.status(500).json({ success: false, message: 'Internal server error.' });

    }
}


export const resendCode = async (req: Request, res: Response) => {
    const { email } = req.body;

    // Validate input
    if (!email) {
        return res.status(400).json({ success: false, message: 'Email is required.' });
    }

    try {
        // Find existing verification record
        let record = await VerificationCode.findOne({ email });

        // Check if a code was recently sent
        const RATE_LIMIT_MINUTES = 5; // Adjust as per requirements
        const now = new Date();

        if (record) {
            const delay = 60 * 5; // delya 5 minutes
            const timeSinceLastSend = (now.getTime() - record.createdAt.getTime()) / (delay * 1000);
            if (timeSinceLastSend < RATE_LIMIT_MINUTES) {
                return res.status(429).json({
                    success: false,
                    message: `Please wait ${Math.ceil(RATE_LIMIT_MINUTES - timeSinceLastSend)} minute(s) before requesting another code.`,
                });
            }

            // Reuse the existing code if it hasn’t expired
            if (record.expiredAt.getTime() > now.getTime()) {
                await sendVerificationEmail(email, record.code); // Resend the existing code
                return res.json({
                    success: true,
                    message: 'Verification code resent successfully.',
                });
            }
        }

        // Generate a new code if no valid code exists
        const newCode = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit random code
        const newExpiration = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
        if (record) {
            // Update the existing record
            record.code = newCode;
            record.expiredAt = newExpiration;
            record.createdAt = now;
            await record.save();
        } else {
            // Create a new record
            record = await VerificationCode.create({
                email,
                code: newCode,
                expiredAt: newExpiration,
                createdAt: now,
            });
        }

        // Send the new code via email
        await sendVerificationEmail(email, newCode);

        // Respond to the client
        res.json({
            success: true,
            message: 'A new verification code has been sent to your email.',
        });
    } catch (error) {
        console.error('Error during resendCode:', error);
        res.status(500).json({
            success: false,
            message: 'An error occurred while resending the verification code. Please try again later.',
        });
    }
}
