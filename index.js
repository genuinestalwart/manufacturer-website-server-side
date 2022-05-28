require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const stripe = require('stripe')(process.env.STRIPE_SECRECT_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;

// Middlewares
app.use(express.json());
app.use(cors());

// Verifying and validating JWT
const verifyJWT = async (req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        return res.status(401).send({ message: 'unauthorized access' });
    }

    const token = authHeader.split((' '))[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(403).send({ message: 'forbidden access' });
        }

        req.decoded = decoded;
        next();
    });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.CLUSTER_URL}/ManufactureOnline?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

const fetchData = async () => {
    try {
        await client.connect();
        const db = client.db('ManufactureOnline');
        const productsColl = db.collection('Products');
        const ordersColl = db.collection('Orders');
        const usersColl = db.collection('Users');

        app.post('/signup', async (req, res) => {
            await usersColl.insertOne(req.body);
            res.status(200).send({ message: 'user created' });
        });

        app.get('/verify-admin', verifyJWT, async (req, res) => {
            const user = await usersColl.findOne(req.query);
            res.send(user);
        });

        app.get('/products', async (req, res) => {
            const products = await productsColl.find({}).toArray();
            res.send(products);
        });

        app.get('/product/:_id', async (req, res) => {
            const product = await productsColl.findOne({ "_id": ObjectId(req.params._id) });
            res.send(product);
        });

        app.put('/purchase', verifyJWT, async (req, res) => {
            await ordersColl.insertOne(req.body);
            res.status(200).send({ message: 'purchase successful' });
        });

        app.get('/orders', verifyJWT, async (req, res) => {
            const orders = await ordersColl.find(req.query).toArray();
            res.send(orders);
        });

        app.get('/order', verifyJWT, async (req, res) => {
            const order = await ordersColl.findOne({ "_id": ObjectId(req.query._id) });
            res.send(order);
        });

        app.delete('/cancel-order', verifyJWT, async (req, res) => {
            await ordersColl.deleteOne({ "_id": ObjectId(req.body._id) });
            res.send({ message: 'order deleted' });
        });

        app.post("/create-payment-intent", verifyJWT, async (req, res) => {
            const { totalPrice } = req.body;
            const amount = totalPrice * 100;

            // Create a PaymentIntent with the order amount and currency
            const paymentIntent = await stripe.paymentIntents.create({
                amount, currency: "usd",
                payment_method_types: ['card']
            });

            res.send({ clientSecret: paymentIntent.client_secret, });
        });

        app.post('/payment', verifyJWT, async (req, res) => {
            const { transactionId, orderId } = req.body;
            await ordersColl.updateOne({ "_id": ObjectId(orderId) }, {
                $set: {
                    transactionId, paid: true
                }
            });
            res.send({ message: 'payment info saved' });
        });
    } finally {

    }
};

fetchData().catch(console.dir);

// Creating APIs
app.get('/', (req, res) => {
    res.send('Hello world!');
});

// Creating JWT
app.post('/auth', (req, res) => {
    const user = req.body;
    const accessToken = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1d' });
    res.send({ accessToken });
});

// Verifying User
app.get('/verify', verifyJWT, (req, res) => {
    const decodedEmail = req.decoded.email;
    const queryEmail = req.query.email;

    if (queryEmail === decodedEmail) {
        res.status(200).send({ message: 'valid user' });
    } else {
        res.status(403).send({ message: 'forbidden access' });
    }
});

// Listening to port
app.listen(port, () => {
    console.log('Listening to port:', port);
});