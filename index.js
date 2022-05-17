const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const { MongoClient, ServerApiVersion } = require('mongodb');
require('dotenv').config()
const app = express()
const port = process.env.PORT || 5000

//middlewear
app.use(cors())
app.use(express.json())


//mongodb connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.yhxig.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });

async function run() {
    try {
        await client.connect();
        const serviceCollection = client.db('treatment_service').collection('services')
        const bookingCollection = client.db('treatment_service').collection('bookings')
        const userCollection = client.db('treatment_service').collection('users')

        app.get('/service', async (req, res) => {
            const query = {}
            const cursor = serviceCollection.find(query);
            const services = await cursor.toArray()
            res.send(services)
        });

        app.put('/user/:email', async (req, res) => {
            const email = req.params.email;
            const user = req.body;
            const filter = { email: email };
            const options = { upsert: true };
            const updatedDoc = {
                $set: user
            }
            const result = await userCollection.updateOne(filter, updatedDoc, options);
            const token = jwt.sign({ email: email }, process.env.ACCESS_TOKEN_SECRET, {
                expiresIn: '1h'
            })
            res.send({ result, token })
        });

        //This is not the proper way to query
        //after learning more about mongodb,use aggregate lookup,pipeline,match,group  
        app.get('/available', async (req, res) => {
            const date = req.query.date;

            //step 1:get all services
            const services = await serviceCollection.find().toArray()

            //step 2:get the booking of that day.output [{},{},{},{}]
            const query = { date }
            const bookings = await bookingCollection.find(query).toArray()

            //step 3:for each service
            services.forEach(service => {
                //step 4:find bookings for that service.output:[{},{}]
                const serviceBookings = bookings.filter(book => book.treatment === service.name);
                //step 5:select slots for the service Bookings.output:['','']
                const bookedSlots = serviceBookings.map(book => book.slot);
                //step 6:select those slots that are not in bookedSlots
                const available = service.slots.filter(slot => !bookedSlots.includes(slot));
                //step 7:set available slots to make it easier
                service.slots = available
            })
            res.send(services)
        });

        app.get('/booking', async (req, res) => {
            const patientEmail = req.query.patientEmail;
            const query = { patientEmail }
            const bookings = await bookingCollection.find(query).toArray();
            res.send(bookings)
        })

        app.post('/booking', async (req, res) => {
            const booking = req.body;
            const query = { treatment: booking.treatment, date: booking.date, patientEmail: booking.patientEmail }
            const exist = await bookingCollection.findOne(query)
            if (exist) {
                return res.send({ success: false, booking: exist })
            }
            const result = await bookingCollection.insertOne(booking);
            return res.send({ success: true, result })
        });

        /**
         * API Naming Convention
         * app.get('/booking') // get all bookings in this collection. or get more than one or by filter
         * app.get('/booking/:id') // get a specific booking 
         * app.post('/booking') // add a new booking
         * app.patch('/booking/:id) //
         * app.put('/booking/:id) //upsert=>update(if exists)or insert(if doesn't exists)
         * app.delete('/booking/:id) //
        */

    }
    finally {

    }
}
run().catch(console.dir)



//server testing
app.get('/', (req, res) => {
    res.send('treatment service server is running')
})

app.listen(port, () => {
    console.log('listening to port', port)
})