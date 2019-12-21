const express = require('express')
const app = express()
const bodyParser = require('body-parser')
const moment = require('moment')
const async = require('async')

const cors = require('cors')

const mongoose = require('mongoose')
mongoose.connect(process.env.MLAB_URI || 'mongodb://localhost/exercise-track' )
const Schema = mongoose.Schema;

app.use(cors())

app.use(bodyParser.urlencoded({extended: false}))
app.use(bodyParser.json())


app.use(express.static('public'))
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/views/index.html')
});

const User = mongoose.model(
  "User",
  new Schema({
    username: { type: String, required: true },
  }), 'user'
);


const Exercise = mongoose.model(
  "Exercise",
  new Schema({
    userId: { type: Schema.Types.ObjectId, ref: "User", required: true },
    description: {type: String, required: true},
    duration: {type: Number, required: true},
    date: {type: Date}
  }), 'exercise'
);

function done(err, data) {
  if (err) {console.log(err)}
  if (data) {console.log(data)}
return};


app.post('/api/exercise/new-user', function (req,res){
  let user = new User({username: req.body.username})
  user.save(function(err,user){
    if (err){
      return done(err)
    } 
    let savedUser = User.findOne({username: user.username}, function(err,savedUser){
      if (err){
        return done(err)
      }
     res.send({username: savedUser.username, _id: savedUser._id});
    })
  })
})

app.get('/api/exercise/users', function(req,res){
  User.find({}).select("username _id __v").exec( function(err, users) {
    res.send(users);  
  });
})

app.post('/api/exercise/add', function(req,res){
  let exercise = new Exercise({userId: req.body.userId, description: req.body.description, 
                              duration: req.body.duration, date: req.body.date})
  if (req.body.date){
    exercise.date = req.body.date
  } else {
    exercise.date = new Date();
  }
  exercise.save(function(err,exercise){
    if (err){
      return done(err)
    }
    User.findOne({_id: exercise.userId}, function(err, user){
      res.send({username: user.username, description: exercise.description, 
              duration: exercise.duration, _id: exercise.userId, date: moment(exercise.date).format("ddd MMM DD YYYY")});
    })
  })
})

app.get('/api/exercise/log', function(req,res){
  async.parallel({
    user: function(callback){
      User.findById(req.query.userId).exec(callback);
    }, 
    exercises: function(callback){
      let result = Exercise.find({userId: req.query.userId}).sort("-date")
      if (req.query.limit){
        result = result.limit(parseInt(req.query.limit))
      } 
      if (req.query.from){
        result = result.where('date').gt(new Date(req.query.from))
      }
      if (req.query.to){
        result = result.where('date').lt(new Date(req.query.to))
      }
      result.exec(callback)
    }
  }, function(err,results){
    if (err) {
      return done(err)
    }
    let log = [];
    results.exercises.forEach((exercise)=> {
      log.push({description: exercise.description, duration: exercise.duration, date: moment(exercise.date).format("ddd MMM DD YYYY")})
    })
    res.send({_id: results.user._id, username: results.user.username, count: results.exercises.length, log: log})
    
  })
  
})

// Not found middleware
app.use((req, res, next) => {
  return next({status: 404, message: 'not found'})
})

// Error Handling middleware
app.use((err, req, res, next) => {
  let errCode, errMessage

  if (err.errors) {
    // mongoose validation error
    errCode = 400 // bad request
    const keys = Object.keys(err.errors)
    // report the first validation error
    errMessage = err.errors[keys[0]].message
  } else {
    // generic or custom error
    errCode = err.status || 500
    errMessage = err.message || 'Internal Server Error'
  }
  res.status(errCode).type('txt')
    .send(errMessage)
})


const listener = app.listen(process.env.PORT || 3000, () => {
  console.log('Your app is listening on port ' + listener.address().port)
})

