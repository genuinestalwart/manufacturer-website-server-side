const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const app = express();
const port = process.env.PORT || 5000;
require('dotenv').config();

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

        app.get('/products', async (req, res) => {
            const products = await productsColl.find({}).toArray();
            res.send(products);
        });

        app.get('/product/:_id', async (req, res) => {
            const product = await productsColl.findOne({ "_id": ObjectId(req.params._id) });
            res.send(product);
        });

        app.put('/purchase', async (req, res) => {
            const {
                deliverTo, amount, email,
                phoneNumber, productId,
                totalPrice, username
            } = req.body;
            const user = await ordersColl.findOne({ email, username });

            if (user) {
                await ordersColl.updateOne({ "_id": ObjectId(user._id) },
                    {
                        $push: {
                            orders: { productId, amount, totalPrice, deliverTo, phoneNumber }
                        }
                    });
            } else {
                const cart = {
                    username, email, orders: [
                        {
                            productId, amount, totalPrice, deliverTo, phoneNumber
                        }
                    ]
                };
                await ordersColl.insertOne(cart);
            }

            res.status(200).send({ message: 'purchase successful' });
        });

        app.get('/orders', async (req, res) => {
            const orders = await ordersColl.findOne(req.query);
            res.send(orders.orders);
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