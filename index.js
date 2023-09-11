const express = require('express');
const app = express();
require('dotenv').config()
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const stripe = require('stripe')(process.env.PAYMENT_SECRET_KEY);
const jwt = require('jsonwebtoken'); //step0: declare jwt
const port = process.env.PORT || 5000;

//middleware
app.use(cors());
app.use(express.json())


//step2: verify jwt token
const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        res.status(401).send({ error: true, message: 'unauthorized access' });
    }
    //bearer token
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            res.status(401).send({ error: true, message: 'unauthorized access' });
        }
        req.decoded = decoded;
        next();
    })

}


const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.lf3ijbn.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const usersCollection = client.db('summerCamp').collection('users');
        const classesCollection = client.db('summerCamp').collection('classes');
        const InstructorCoursesCollection = client.db('summerCamp').collection('instructorCourses');
        const teachersCollection = client.db('summerCamp').collection('teachers');
        const cartCollection = client.db('summerCamp').collection('carts');
        const approvedCoursesCollection = client.db('summerCamp').collection('approvedCourses');

        //step1:implement jwt-----make token and go to client side (AuthProvider.jsx)
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send(token);
        })

        //verifyAdmin secure apis
        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        //verifyInstructor secure apis
        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }


        //Get Users who create account and use this website and save data on database----------------------------------------------------------------
        //TODE : verifyAdmin 
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        })

        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: 'user already exists' });
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        })

        //Is Register Person user or admin check it. 3 Step
        /**
         * security layer: verifyJWT
         * email same
         * check admin
        */
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ admin: false });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        })

        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await usersCollection.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.delete('/users/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await usersCollection.deleteOne(query);
            res.send(result);
        })

        //Is Register Person user or instructor check it. 3 Step
        /**
         * security layer: verifyJWT
         * email same
         * check instructor
        */

        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                res.send({ instructor: false });
            }

            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { instructor: user?.role === 'instructor' };
            res.send(result);
        })

        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };
            const result = await usersCollection.updateOne(query, updateDoc);
            res.send(result);
        })



        //Get Courses And Teacher----------------------------------------------------

        app.get('/classes', async (req, res) => {
            const result = await classesCollection.find().toArray();
            res.send(result);
        })

        app.post('/classes', async (req, res) => {
            const course = req.body;
            const result = await classesCollection.insertOne(course);
            res.send(result);
        })

        app.get('/teachers', async (req, res) => {
            const result = await teachersCollection.find().toArray();
            res.send(result);
        })


        //Get Approved Courses----------------------------------------------------

        app.get('/approvedCourses', async (req, res) => {
            const result = await approvedCoursesCollection.find().toArray();
            res.send(result);
        })

        app.get('/approvedCourses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await approvedCoursesCollection.findOne(query);
            res.send(result);
        })

        //only show login instructor approved classes: 
        app.get('/myApprovedCourses', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            else {
                const query = { email: email };
                const result = await approvedCoursesCollection.find(query).toArray();
                res.send(result);
            }
        })

        app.post('/approvedCourses', async (req, res) => {
            const course = req.body;
            const result = await approvedCoursesCollection.insertOne(course);
            res.send(result);
        })

        // Approve Course update
        app.put('/approvedCourses/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateApprovedCourse = req.body;
            const update = {
                $set: {
                    status: updateApprovedCourse.status,
                    email: updateApprovedCourse.email,
                    image: updateApprovedCourse.image,
                    instructor: updateApprovedCourse.instructor,
                    name: updateApprovedCourse.name,
                    price: updateApprovedCourse.price,
                    seats: updateApprovedCourse.seats
                }
            };
            const result = await approvedCoursesCollection.updateOne(filter, update, options);
            res.send(result);
        })



        //Get Instructor Wise Courses----------------------------------------------------

        // get all instructor courses
        app.get('/instructorCourses', async (req, res) => {
            const result = await InstructorCoursesCollection.find().toArray();
            res.send(result);
        })

        app.get('/instructorCourses/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await InstructorCoursesCollection.findOne(query);
            res.send(result);
        })

        //Courses status update
        app.get('/updateCoursesStatus/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await InstructorCoursesCollection.findOne(query);
            res.send(result);
        })

        app.get('/denyCoursesStatus/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await InstructorCoursesCollection.findOne(query);
            res.send(result);
        })


        //only show login instructor Data: 
        app.get('/myCourses', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            else {
                const query = { email: email };
                const result = await InstructorCoursesCollection.find(query).toArray();
                res.send(result);
            }
        })

        app.post('/instructorCourses', async (req, res) => {
            const instructorCourses = req.body;
            const result = await InstructorCoursesCollection.insertOne(instructorCourses);
            res.send(result);
        })

        //Courses all data update
        app.put('/instructorCourses/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updatedClass = req.body;
            const course = {
                $set: {
                    name: updatedClass.name,
                    seats: updatedClass.seats,
                    price: updatedClass.price

                }
            };
            const result = await InstructorCoursesCollection.updateOne(filter, course, options);
            res.send(result);
        })

        //Courses Approved status update
        app.put('/updateCoursesStatus/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateCourseStatus = req.body;
            const updateStatus = {
                $set: {
                    status: updateCourseStatus.status,
                    email: updateCourseStatus.email,
                    image: updateCourseStatus.image,
                    instructor: updateCourseStatus.instructor,
                    name: updateCourseStatus.name,
                    price: updateCourseStatus.price,
                    seats: updateCourseStatus.seats
                }
            };
            const result = await InstructorCoursesCollection.updateOne(filter, updateStatus, options);
            res.send(result);
        })

        //Courses deny and denied reason status update
        app.put('/denyCoursesStatus/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const options = { upsert: true };
            const updateCourseStatus = req.body;
            const updateStatus = {
                $set: {
                    status: updateCourseStatus.status,
                    feedback: updateCourseStatus.feedback,
                }
            };
            const result = await InstructorCoursesCollection.updateOne(filter, updateStatus, options);
            res.send(result);
        })


        //Cart Collection-------------------------------------------------------------

        //only show login user Data: 
        app.get('/carts', async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }
            else {
                const query = { email: email };
                const result = await cartCollection.find(query).toArray();
                res.send(result);
            }
        })

        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })

        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        })


        //Payment System Implement----------------------------------------------------

        app.post("/create-payment-intent", async (req, res) => {
            const { price } = req.body;
            const amount = price * 100;

            console.log(price);
            console.log(amount);

            const paymentIntent = await stripe.paymentIntents.create({
                amount: amount,
                currency: "usd",
                payment_method_types: ['card']
            })

            res.send({
                clientSecret: paymentIntent.client_secret,
            });
        })




        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('SUMMER SCHOOL CAMP RUNNING');
})

app.listen(port, () => {
    console.log(`Summer School Camp running on port: ${port}`);
})