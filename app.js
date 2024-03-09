const express = require('express');
const bodyParser = require('body-parser');
const session = require('express-session');
const { insertUser, authenticateUser,initializeDB,closeDB,getUserDetails,insertBooks,insertAuthorDetails,addToCart,getBookStock,updateUserDetails,getTotalPrice,placeOrder,removeFromCart,insertReview,addNewBook,removeUser,deleteBook,updateEdition,updatePrice,updateStock,updateDiscount,averageRating,TotalOrder,TotalSales,TotalRevenue,IncreaseDiscountAll,DecreaseDiscountAll,editProfile,updateLastLoginTime,deleteProfileRequest,RequestForBooks} = require('./routes/back');
const {getAllBooks,searchBooks,fetchCartItems,getAllUsers,getAllReviews,fetchBookDetails,getAllRequestedBooks} = require('./routes/auth');

const app = express();
const port = 3000;
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
app.use(express.static('public'));
app.use(session({
  secret: 'your_secret_key_here',
  resave: true,
  saveUninitialized: true
}));

const multer = require('multer');
const upload = multer();

app.set('view engine', 'ejs');

initializeDB()
  .then(() => {
    app.get('/home', async (req, res) => {
      try {
        const { name, author, category, lowPrice, highPrice } = req.query;
        const searchParams = { name, author, category, lowPrice, highPrice };
        const books = await getAllBooks(searchParams);
        res.render('home', { books }); 
      } catch (error) {
        console.error('Failed to load books:', error);
        res.status(500).render('error', { error: 'Failed to load books' });
      }
    });
    
    app.get('/review', async (req, res) => {
      try {
          const reviews = await getAllReviews();
          console.log(reviews);
          res.render('review', { reviews }); 
      } catch (err) {
          console.error('Error retrieving reviews:', err);
          res.status(500).json({ error: 'Error retrieving reviews' });
      }
    });

    app.get('/signup', (req, res) => {
      res.render('signup', { error: null });
    });

  app.post('/register', async (req, res) => {
      const { f_name, l_name, email, password, date_of_birth, street, city, country } = req.body;

  try {
    await insertUser(f_name, l_name, email, password, date_of_birth, street, city, country);
    res.redirect('/login');
  } catch (error) {
    console.error('Error during user registration:', error);
    res.render('signup', { error: 'An error occurred during signup.' });
  }
});

app.get('/search', async (req, res) => {
  try {
      const { name, author, category, publisher,lowPrice, highPrice } = req.query;
      const searchParams = { name, author, category,publisher,lowPrice, highPrice };
      console.log(searchParams);
      const searchResults = await searchBooks(searchParams);
      res.json(searchResults);
  } catch (error) {
      console.error('Error during search:', error);
      res.status(500).json({ error: 'An error occurred during search.' });
  }
});

app.post('/addToCart', async (req, res) => {
  const { userId, selectedRowInfo, quantity } = req.body;
  const isbn = selectedRowInfo.isbn;

  try {
    if (Number(quantity) === 0) {
      res.status(400).json({ message: 'Quantity cannot be zero.' });
      return;
    }

    if (quantity < 0) {
      res.status(400).json({ message: 'Quantity cannot be negative.' });
      return;
    }

    const stock = await getBookStock(isbn);
    if (stock === null) {
      res.status(400).json({ message: 'Book not found or stock information unavailable.' });
      return;
    }

    if (quantity > stock) {
      res.status(400).json({ message: 'Quantity exceeds available stock.' });
      return;
    }

    else{
      await addToCart(userId, isbn, quantity);
      res.status(200).json({ userId: userId });
    }
    
  } catch (error) {
    console.error('Error adding item to cart:', error);
    res.status(500).json({ error: 'An error occurred while adding item to cart.' });
  }
});


app.get('/cart', async (req, res) => {
  try {
    const userId = req.session.userId;
    const cartItems = await fetchCartItems(userId);
    console.log("fetched value",cartItems);
    res.render('cart', {cartItems});
  } catch (error) {
    console.error('Error rendering cart:', error);
    res.status(500).render('error', { error: 'Failed to render cart' });
  }
});


app.post('/placeOrder', async (req, res) => {
  const userId = req.session.userId;
  const selectedRows = req.body.selectedRows;
  console.log("For place order, user ID:", userId);
  console.log("For place order, selected rows:", selectedRows);
  
  try {
    const totalPrice = await getTotalPrice(userId, selectedRows);
    console.log(`Total price for the order is: ${totalPrice}`);
    res.json({ totalPrice: totalPrice });
  } catch (error) {
    console.error('Error during place order operation:', error);
    res.status(500).json({ error: 'An error occurred while placing the order.' });
  }
});


app.post('/confirmOrder', async (req, res) => {
  const userId = req.session.userId;
  const selectedRows = req.body.selectedRows;
  console.log("For confirm order, user ID:", userId);
  console.log("For confirm order, selected rows:", selectedRows);

  try {
    await placeOrder(userId, selectedRows);
    console.log("Order confirmed successfully");
    res.json({ message: "Order confirmed successfully" });
  } catch (error) {
    console.error('Error confirming order:', error);
    res.status(500).json({ error: 'An error occurred while confirming the order.' });
  } 
  
});


app.post('/removeFromCart', async (req, res) => {
  const userId = req.session.userId;
  const selectedRows = req.body.selectedRows;
  console.log("For remove from cart, user ID:", userId);
  console.log("For remove from cart, selected rows:", selectedRows);

  try {
    const operationMessages = await removeFromCart(userId, selectedRows);
    res.json({ message: 'Operation completed', details: operationMessages });
  } catch (error) {
    console.error('Error removing items from cart:', error);
    res.status(500).json({ error: 'An error occurred while removing items from cart.' });
  }
});


app.post('/postReview', async (req, res) => {
  const userId = req.session.userId;
  if (!userId) {
    return res.status(403).json({ message: 'User not logged in.' });
  }

  const { selectedRowInfo, rating, review } = req.body;
  const isbn = selectedRowInfo.isbn; 

  try {
    await insertReview(userId, isbn, rating, review);
    res.status(200).json({ message: 'Review posted successfully.' });
  } catch (error) {
    console.error('Error posting review:', error);
    res.status(500).json({ error: 'An error occurred while posting the review.' });
  }
});


app.get('/DeleteProfile', (req, res) => {
  res.render('DeleteProfile');
});


app.post('/deleteProfile', async (req, res) => {
  const userId = req.session.userId;
  console.log("User to delete:", userId);
  console.log('Received delete profile request:', req.body);
  
  try {
    await deleteProfileRequest(userId);
    res.status(200).json({ message: 'Deletion requested successfully' });
  } catch (err) {
    console.error("Error while requesting profile deletion:", err);
    res.status(500).json({ message: 'Error requesting profile deletion' });
  }
});


app.get('/adminlogin', (req, res) => {
  res.render('adminlogin', { error: null });
 });

 app.post('/adminlogin', async (req, res) => {
  const { email, password } = req.body;
  if (email === 'buet@gmail.com' && password === 'abcd') {
      res.render('adminhome');
  }
  else {
    res.render('login', { error: 'Invalid email or password' });
  }
});

app.get('/logout', (req, res) => {
  req.session.destroy((err) => {
      if (err) {
          console.error('Error destroying session:', err);
          res.status(500).send('An error occurred during logout');
      } else {
          res.redirect('/home');
      }
  });
});

app.get('/allbooks', async (req, res) => {
  try {
    const books = await getAllBooks();
    res.render('allbooks', { books });
  } catch (error) {
    console.error('Error fetching books:', error);
    res.status(500).render('error', { error: 'Failed to fetch books' });
  }
});

app.post('/deleteBook', async (req, res) => {
  const selectedRowInfo = req.body.selectedRowInfo;
  const isbn = selectedRowInfo.isbn; 
  try {
    const deleteResult = await deleteBook(isbn);
    if (deleteResult.success) {
      res.status(200).json({ message: deleteResult.message });
    } else {
      res.status(404).json({ message: deleteResult.message });
    }
  } catch (error) {
    console.error('Failed to delete book:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


app.get('/addnewbook', (req, res) => {
  res.render('addnewbook');
});

app.post('/addnewbook', async (req, res) => {
  const { ISBN, TITLE, EDITION, PUBLICATION_DATE, PRICE, STOCK, DISCOUNT, CATEGORY, AUTHOR_NAME, PUBLISHER } = req.body;
  try {
    await addNewBook(ISBN, TITLE, EDITION, PUBLICATION_DATE, PRICE, STOCK, DISCOUNT, CATEGORY, AUTHOR_NAME, PUBLISHER);
    res.send({ message: 'Book added successfully' });
  } catch (error) {
    console.error('Error adding new book:', error);
    res.status(500).send({ message: 'Error adding new book' });
  }
});


app.post('/updateBookInfo', async (req, res) => {
  const { isbn, title, edition, price, stock, discount } = req.body;
  console.log("ISBN:", isbn);
  console.log("New Edition:", edition);
  console.log("New Price:", price);
  console.log("New Stock:", stock);
  console.log("New Discount:", discount);

  try {
    if (edition !== null && edition !== undefined && edition !== "") {
      await updateEdition(isbn, edition);
      console.log("Edition updated successfully for ISBN:", isbn);
    }
    if (price != null && price !== undefined && price !== "") {
      await updatePrice(isbn, price);
      console.log("Price updated successfully for ISBN:", isbn);
    }
    if (stock != null && stock !== undefined && stock !== "") {
      await updateStock(isbn, stock);
      console.log("Stock updated successfully for ISBN:", isbn);
    }
    if (discount != null && discount !== undefined && discount !== "") {
      await updateDiscount(isbn, discount);
      console.log("Discount updated successfully for ISBN:", isbn);
    }

    res.json({ message: 'Book info updated successfully' });
  } catch (error) {
    console.error('Error updating book info:', error);
    res.status(500).json({ message: 'Error updating book info' });
  }
});


app.get('/thread', (req, res) => {
  res.render('thread');
});

app.get('/login', (req, res) => {
 res.render('login', { error: null });
});

app.get('/allusers', async (req, res) => {
  try {
    const users = await getAllUsers();
    res.render('allusers', { users });
  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).render('error', { error: 'Failed to fetch users' });
  }
});


app.post('/removeuser', async (req, res) => {
  const userId = req.body.USER_ID;
  console.log("User to remove:", userId);

  try {
    await removeUser(userId);
    res.json({ message: 'User removed successfully.' });
  } catch (error) {
    res.status(500).json({ message: 'Failed to remove user.' });
    console.error('Error removing user:', error);
  }
});


app.post('/avgrating', async (req, res) => {
  try {
      const { isbn } = req.body;
      console.log("avg rating:",isbn);
      const avgRating = await averageRating(isbn);
      res.json({ avgrating: avgRating });
  } catch (error) {
      console.error('Error fetching average rating:', error);
      res.status(500).json({ error: 'Error fetching average rating' });
  }
});


app.post('/totalorder', async (req, res) => {
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  console.log(startDate,endDate);
  try {
    const totalOrder = await TotalOrder(startDate, endDate);
    console.log(totalOrder);
    res.json({ totalOrder: totalOrder });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate total orders' });
  }
});


app.post('/totalsale', async (req, res) => {
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  console.log(startDate,endDate);
  
  try {
    const totalSale = await TotalSales(startDate, endDate);
    console.log(totalSale);
    res.json({ totalSale: totalSale });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate total sale' });
  }
});

app.post('/totalmoney', async (req, res) => {
  const startDate = req.body.startDate;
  const endDate = req.body.endDate;
  console.log(startDate,endDate);

  try {
    const totalMoney = await TotalRevenue(startDate, endDate);
    console.log(totalMoney);
    res.json({ totalMoney: totalMoney });
  } catch (error) {
    res.status(500).json({ error: 'Failed to calculate total revenue' });
  }
});


app.post('/increasedis', async (req, res) => {
  const incr = parseFloat(req.body.dis);
  console.log("incres:", incr);

  try {
    await IncreaseDiscountAll(incr);
    res.send({ success: true, message: `Discount increased by ${incr}% for all books.` });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to increase discount for all books.' });
  }
});


app.post('/decreasedis', async(req, res) => {
  const decr = parseFloat(req.body.dis);
  console.log("decres:",decr);

  try {
    await DecreaseDiscountAll(decr);
    res.send({ success: true, message: `Discount decreased by ${decr}% for all books.` });
  } catch (error) {
    res.status(500).send({ success: false, message: 'Failed to decrease discount for all books.' });
  }
});


app.get('/EditProfile', (req, res) => {
  res.render('EditProfile');
});


app.post('/save', async (req, res) => {
  const userId = req.session.userId;
  const { gmail, password, street, city, country } = req.body;

  try {
    const result = await editProfile(userId, gmail, password, street, city, country);
    res.json(result);
  } catch (error) {
    console.error('Error calling editProfile:', error);
    res.status(500).json({ message: 'An error occurred while updating the profile.' });
  }
});

app.get('/showdetails', (req, res) => {
  res.render('showdetails');
});

app.post('/showdetails', async (req, res) => {
  const { isbn } = req.body;
  try {
    const bookDetails = await fetchBookDetails(isbn);
    res.render('showdetails', { bookDetails });
  } catch (error) {
    console.error('Error fetching book details:', error);
    res.status(500).send('Error fetching book details');
  }
});


app.post('/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const isAuthenticated = await authenticateUser(email, password);

    if (isAuthenticated) {
    const userDetails = await getUserDetails(email);
    await updateLastLoginTime(userDetails.id);
    req.session.userId = userDetails.id;
      console.log(userDetails);
      const books = await getAllBooks();
      res.render('home2', { 
        books: books,
        user: userDetails
      }); 

    }
     else {
      res.render('login', { error: 'Invalid email or password.' });
    }
  } catch (error) {
    console.error('Login error:', error);
    res.render('login', { error: 'An error occurred during login.' });
  }
});


app.get('/thread', (req, res) => {
  res.render('thread');
});

app.get('/reqbook', (req, res) => {
  res.render('reqbook');
}); 


app.post('/request', async (req, res) => {
  const userId = req.session.userId;
  const { title } = req.body;
  console.log("book requested:", title);
  console.log("user id:", userId);

  try {
    await RequestForBooks(userId, title);
    res.send("Book request submitted successfully.");
  } catch (error) {
    console.error("Error submitting book request:", error);
    res.status(500).send("An error occurred while submitting the book request.");
  }
});

app.get('/adminreq', async (req, res) => {
  try {
      const requestbooks = await getAllRequestedBooks();
      console.log(requestbooks);
      res.render('adminreq', {requestbooks}); 
  } catch (err) {
      console.error('Error retrieving requested books:', err);
      res.status(500).json({ error: 'Error retrieving requested books'});
  }
});




 app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});

process.on('SIGINT', async () => {
  console.log('Stopping the server...');
  await closeDB();
  process.exit();
});

})
.catch((err) => {
console.error('Error initializing database connection:', err);
process.exit(1);
});
