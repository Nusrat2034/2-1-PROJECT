const oracledb = require('oracledb');
const axios = require('axios');
const moment = require('moment');

  
  const dbConfig = {
  user: "C##BOOKSTORE",
  password: "bookstore",
  connectString: "localhost:1521/orcl"
  };
  
  let connection;
  
  async function initializeDB() {
    try {
      connection = await oracledb.getConnection(dbConfig);
      console.log('Database connection initialized.');
    } catch (err) {
      console.error('Error initializing database connection:', err);
      throw err;
    }
  }
  
 
  async function closeDB() {
    if (connection) {
      try {
        await connection.close();
        console.log('Database connection closed.');
      } catch (err) {
        console.error('Error closing database connection:', err);
      }
    }
  }
 async function getUserDetails(email){
  try {
    const result = await connection.execute(
      `SELECT * FROM USERS WHERE email = :email`,
      [email],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (result.rows.length === 0) {
      return null;
    }
    const user = result.rows[0];

    return {
      id: user.USER_ID, 
      username: user.F_NAME, 
      email: user.EMAIL, 
    };
  } catch (err) {
    console.error('Error getting user details:', err);
    throw err;
  }
}


async function updateLastLoginTime(userId) {
  try {
    const query = `UPDATE users SET last_login = SYSTIMESTAMP WHERE user_id = :user_id`;
    await connection.execute(query, { user_id: userId }, { autoCommit: true });
    console.log(`Last login time updated for user ID: ${userId}`);
  } catch (error) {
    console.error(`Error updating last login time for user ID: ${userId}`, error);
    throw error; 
  }
}


async function deleteProfileRequest(userId) {
  try {
    const result = await connection.execute(
      `UPDATE users SET deletion_requested = SYSTIMESTAMP WHERE user_id = :userId`,
      { userId }, 
      { autoCommit: true } 
    );
    console.log(`Deletion requested for user ID: ${userId}`);
  } catch (err) {
    console.error(`Error requesting deletion for user ID: ${userId}:`, err);
    throw err; 
  }
}


  async function insertBooks() {
    try {
  
      const categories = [
        'science fiction', 'programming', 'non-fiction', 'history', 'biography',
        'mystery', 'horror', 'romance', 'health', 'travel', 'science',
        'poetry', 'business', 'technology', 'drama', 'fairy tales'
      ];
      let categoryid = 0;
  
      let i = 0;
      let j = 0;
  
      for (const query of categories) 
      {
        categoryid++;
  
        await connection.execute(
          `INSERT INTO CATEGORY (CATEGORY_ID, CATEGORY_NAME) 
           VALUES (:categoryid,:query)`,
          [categoryid,query],
          { autoCommit:true }
        );
    
        const response = await axios.get(`https://www.googleapis.com/books/v1/volumes?q=${query}&maxResults=40`);
        
        
        const existingISBNs = new Set();
        const existingBooks = await connection.execute(
          `SELECT ISBN FROM BOOKS`
        );
        existingBooks.rows.forEach(row => existingISBNs.add(row.ISBN));
    
    
        for (const item of response.data.items) {
    
          const book = item.volumeInfo;
          const isbn = book.industryIdentifiers?.find(identifier => identifier.type === 'ISBN_13')?.identifier;
          if (!isbn) {
            console.log('ISBN undefined, skipping book.');
            continue; 
          }
    
          const title = book.title;
          const edition = Math.floor(Math.random() * 10) + 1;
          const publicationDate = book.publishedDate ? moment(book.publishedDate).format('YYYY-MM-DD') : '2000-01-01';
          const price = Math.random() * (2000 - 200) + 200; 
          const status = 'Available';
          let stock = Math.floor(Math.random() * 50) + 1;
          stock = stock > 0 ? stock : 1;
          const discount = Math.floor(Math.random() * (10 - 5 + 1)) + 5;
    
          if (isbn && !existingISBNs.has(isbn)) {
            const publisher = book.publisher ? book.publisher : 'Unknown Publisher'; 
            let publisherId;
    
            const publisherResult = await connection.execute(
              `SELECT PUBLISHER_ID FROM PUBLISHER WHERE NAME = :publisher`,
              [publisher]
            );
      
            if (publisherResult.rows.length > 0) {
              publisherId = publisherResult.rows[0].PUBLISHER_ID;
            } 
            else
            {
              publisherId = ++i;
              await connection.execute(
                `INSERT INTO PUBLISHER (PUBLISHER_ID, NAME) 
                 VALUES (:publisherId,:publisher)`,
                [publisherId,publisher],
                { autoCommit: true }
              );
            }
    
    
            await connection.execute(
              `INSERT INTO BOOKS (ISBN, TITLE, EDITION, PUBLISHER_ID, PUBLICATION_DATE, PRICE, STATUS, STOCK, DISCOUNT) 
               VALUES (:isbn, :title, :edition, :publisherId, TO_DATE(:publicationDate, 'YYYY-MM-DD'), :price, :status, :stock, :discount)`,
              [isbn, title, edition, publisherId, publicationDate, price, status, stock, discount],
              { autoCommit: true }
            );
    
            const authorName = book.authors && book.authors[0] ? book.authors[0] : 'Unknown Author';
            let authorId;
    
    
            if(authorName !== 'Unknown Author')
            {
              const authorResult = await connection.execute(
                `SELECT AUTHOR_ID FROM AUTHOR WHERE AUTHOR_NAME = :authorName`,
                [authorName]
              );
      
              if (authorResult.rows.length > 0) {
                authorId = authorResult.rows[0].AUTHOR_ID;
              } else {
                authorId = ++j; 
                await connection.execute(
                  `INSERT INTO AUTHOR (AUTHOR_ID, AUTHOR_NAME) 
                   VALUES (:authorId, :authorName)`,
                  [authorId, authorName],
                  { autoCommit: true }
                );
              }
            }
            
            
            await connection.execute(
              `INSERT INTO BOOKS_CATEGORY (ISBN, CATEGORY_ID) 
               VALUES (:isbn,:categoryid)`,
              [isbn,categoryid],
              { autoCommit: true }
            );
    
    
          } else {
            console.log(`ISBN ${isbn} already exists, skipping insertion.`);
          }
        }
    
        console.log('Books data inserted successfully');
        
      }
      
    } catch (error) {
      console.error('Error inserting books:', error);
      throw error;
    }
  }
  
  
  async function insertAuthorDetails() {
    try {
      const response = await axios.get('https://randomuser.me/api/?results=447');
      let authorId = 0;
  
      for (const person of response.data.results) {
        authorId++;
        const isoDateOfBirth = person.dob.date;
        const dateofbirth = isoDateOfBirth.substring(0, 10); 
        const email = person.email;
        const phoneNumber = person.cell;
        const street = person.location.street.number + ',' + person.location.street.name;
        const city = person.location.city;
        const country = person.location.country;
  
  
        const updateSql = `
        UPDATE AUTHOR SET
          DATE_OF_BIRTH = TO_DATE(:dateofbirth, 'YYYY-MM-DD'),
          EMAIL = :email,
          PHONE_NUMBER = :phoneNumber,
          STREET = :street,
          CITY = :city,
          COUNTRY = :country
        WHERE AUTHOR_ID = :authorId
      `;
  
      await connection.execute(
        updateSql,
        {
          dateofbirth,
          email,
          phoneNumber,
          street,
          city,
          country,
          authorId
        },
        { autoCommit: true }
      );
  
      }
  
      console.log('Data inserted successfully in AUTHOR Table');
      
    } catch (error) {
      console.error('Error inserting Author details:', error);
      throw error;
    }
  }
  
  
  
  
  async function insertUser(f_name, l_name, email, password, date_of_birth, street, city, country) {
  
    try {
      const result = await connection.execute(
        `INSERT INTO users (f_name, l_name, email, password, date_of_birth, street, city, country)
         VALUES (:f_name, :l_name, :email, :password, TO_DATE(:date_of_birth, 'YYYY-MM-DD'), :street, :city, :country)`,
        [f_name, l_name, email,password, date_of_birth, street, city, country],
        { autoCommit: true }
      );
      console.log('User registered:', result);
    } catch (err) {
      console.error(err);
      throw err; 
   }
  }
  
 
  async function authenticateUser(email, password) {
    
      try {
        
        const result = await connection.execute(
          `SELECT password FROM users WHERE email = :email`,
          [email],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
    
        if (result.rows.length > 0) {
          const storedPassword = result.rows[0].PASSWORD; 
          return password === storedPassword;
      }
      
        return false;
      } catch (err) {
        console.error(err);
        return false;
      } 
    }

    
    async function addToCart(userId, isbn, quantity) {
      try {
        let cartId;
    
        await connection.execute(`LOCK TABLE CART IN EXCLUSIVE MODE`);

        const cartCheckResult = await connection.execute(
          `SELECT CART_ID FROM CART WHERE user_id = :userId`,
          [userId],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
    
        if (cartCheckResult.rows.length > 0) {
          cartId = cartCheckResult.rows[0].CART_ID;
        } else {
          const nextIdResult = await connection.execute(
          `SELECT NVL(MAX(CART_ID), 0) + 1 AS NEXT_ID FROM CART`,
          [],
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          cartId = nextIdResult.rows[0].NEXT_ID;

          await connection.execute(
          `INSERT INTO CART (CART_ID, user_id, DATE_CREATED) VALUES (:cartId, :userId, SYSDATE)`,
          { cartId, userId },
          { autoCommit: true }
         );
        }
  
        const itemCheckResult = await connection.execute(
          `SELECT BOOK_COUNT FROM IN_CART_ITEMS WHERE CART_ID = :cartId AND ISBN = :isbn`,
          { cartId, isbn },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
    
        if (itemCheckResult.rows.length > 0) {
          const newBookCount = Number(itemCheckResult.rows[0].BOOK_COUNT) + Number(quantity);

          await connection.execute(
            `UPDATE IN_CART_ITEMS SET BOOK_COUNT = :newBookCount WHERE CART_ID = :cartId AND ISBN = :isbn`,
            { newBookCount, cartId, isbn },
            { autoCommit: true }
          );
        } else {
          await connection.execute(
            `INSERT INTO IN_CART_ITEMS (CART_ID, ISBN, BOOK_COUNT) VALUES (:cartId, :isbn, :quantity)`,
            { cartId, isbn, quantity },
            { autoCommit: true }
          );
        }
    
        console.log('Cart updated successfully');
      } catch (err) {
        console.error('Error updating cart:', err);
        throw err;
      }
    }


    async function getBookStock(isbn) {
      try {
        const result = await connection.execute(
          `SELECT STOCK FROM BOOKS WHERE ISBN = :isbn`,
          [isbn], 
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
    
        if (result.rows.length > 0) {
          return result.rows[0].STOCK; 
        } else {
          return null; 
        }
      } catch (err) {
        console.error('Error fetching book stock:', err);
        throw err;
      }
    }



    

async function getTotalPrice(userId, selectedRows) {
  let totalPrice = 0;

  try {
    for (const row of selectedRows) {
      const isbn = row.isbn;
      const quantity = parseInt(row.book_count, 10);

      const bookDetails = await connection.execute(
        `SELECT PRICE, DISCOUNT FROM BOOKS WHERE ISBN = :isbn`,
        [isbn],
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      if (bookDetails.rows.length > 0) {
        const { PRICE, DISCOUNT } = bookDetails.rows[0];
        const discountMultiplier = (100 - DISCOUNT) / 100;
        const priceAfterDiscount = PRICE * discountMultiplier;

        totalPrice += (priceAfterDiscount * quantity);
      } else {
        console.error(`Book with ISBN ${isbn} not found.`);
      }
    }

    return totalPrice.toFixed(2); 
  } catch (err) {
    console.error('Error calculating total price:', err);
    throw err;
  }
}



async function placeOrder(userId, selectedRows) {
  let orderId;
  let totalPrice;
  let message = "";

  try {
      const orderResult = await connection.execute(
          `BEGIN :ret := INSERT_ORDERS_TABLE(:userId); END;`,
          { ret: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }, userId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      orderId = orderResult.outBinds.ret;

      if (orderId < 0) {
          throw new Error('Failed to insert order into ORDERS table.');
      }

      for (let i = 0; i < selectedRows.length; i++) {
          let row = selectedRows[i];
          let procMessage = { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 };
          await connection.execute(
              `BEGIN INSERT_ORDERED_ITEMS_TABLE(:orderId, :isbn, :bookCount, :msg); END;`,
              { orderId, isbn: row.isbn, bookCount: row.book_count, msg: procMessage },
              { outFormat: oracledb.OUT_FORMAT_OBJECT }
          );
          message += `Row ${i+1}: ${procMessage.val}; `;
      }

      const totalPriceResult = await connection.execute(
          `BEGIN :ret := CALCULATE_ORDER_TOTAL_PRICE_AMOUNT(:orderId); END;`,
          { ret: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER }, orderId },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      totalPrice = totalPriceResult.outBinds.ret;

      if (totalPrice < 0) {
          throw new Error('Failed to calculate total price for the order.');
      }

      await connection.execute(
          `UPDATE ORDERS SET TOTAL_AMOUNT = :totalPrice WHERE ORDER_ID = :orderId`,
          { totalPrice, orderId },
          { autoCommit: true }
      );

      let paymentProcMessage = { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 };

      await connection.execute(
      `BEGIN INSERT_PAYMENTS_TABLE(:p_order_id, :p_user_id, :p_total_amount, :msg); END;`,
      { 
          p_order_id: orderId, 
          p_user_id: userId, 
          p_total_amount: totalPrice, 
          msg: paymentProcMessage 
      },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      message += ` Payment Insertion: ${paymentProcMessage.val}; `;
  } catch (err) {
      console.error('Error confirmng order:', err);
      throw err;
  }
}



async function removeFromCart(userId, selectedRows) {
  let operationMessages = [];

  try {
    for (const row of selectedRows) {
      const isbn = row.isbn;
      let procedureResult = { p_msg: { dir: oracledb.BIND_OUT, type: oracledb.STRING, maxSize: 500 } };

      await connection.execute(
        `BEGIN REMOVE_ITEM_FROM_CART(:userId, :isbn, :p_msg); END;`,
        { userId, isbn, ...procedureResult },
        { autoCommit: true }
      );

      operationMessages.push(procedureResult.p_msg);
    }
    console.log('Cart update operations completed.');
    return operationMessages; 
  } catch (err) {
    console.error('Error removing items from cart:', err);
    throw err;
  }
}


async function insertReview(userId, isbn, rating, reviewText) {
  try {
    const idResult = await connection.execute(
      `SELECT MAX(REVIEW_ID) + 1 AS NEXT_ID FROM CUSTOMER_REVIEW`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    let nextId = idResult.rows[0].NEXT_ID;
    if (!nextId) nextId = 1; 

    const sql = `
      INSERT INTO CUSTOMER_REVIEW (REVIEW_ID, user_id, ISBN, RATING, REVIEW_TEXT, DATE_POSTED)
      VALUES (:nextId, :userId, :isbn, :rating, :reviewText, SYSDATE)
    `;

    const binds = { nextId, userId, isbn, rating, reviewText };

    await connection.execute(sql, binds, { autoCommit: true });
    console.log('Review inserted successfully with REVIEW_ID:', nextId);
  } catch (err) {
    console.error('Error inserting review with manual REVIEW_ID:', err);
    throw err;
  }
}


async function addNewBook(ISBN, TITLE, EDITION, PUBLICATION_DATE, PRICE, STOCK, DISCOUNT, CATEGORY, AUTHOR_NAME, PUBLISHER) {
  let publisherId, authorId, categoryId;
  let status = 'Available';
  
  try {
    const publisherResult = await connection.execute(
      `SELECT PUBLISHER_ID FROM PUBLISHER WHERE LOWER(NAME) = LOWER(:PUBLISHER)`,
      [PUBLISHER],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (publisherResult.rows.length > 0) {
      publisherId = publisherResult.rows[0].PUBLISHER_ID;
    } else {
      const maxPubIdResult = await connection.execute(`SELECT NVL(MAX(PUBLISHER_ID), 0) + 1 AS NEXT_ID FROM PUBLISHER`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      publisherId = maxPubIdResult.rows[0].NEXT_ID;
      await connection.execute(
        `INSERT INTO PUBLISHER (PUBLISHER_ID, NAME) VALUES (:publisherId, :PUBLISHER)`,
        { publisherId, PUBLISHER },
        { autoCommit: true }
      );
    }

    const authorResult = await connection.execute(
      `SELECT AUTHOR_ID FROM AUTHOR WHERE AUTHOR_NAME = :AUTHOR_NAME`,
      [AUTHOR_NAME],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (authorResult.rows.length > 0) {
      authorId = authorResult.rows[0].AUTHOR_ID;
    } else {
      const maxAuthorIdResult = await connection.execute(`SELECT NVL(MAX(AUTHOR_ID), 0) + 1 AS NEXT_ID FROM AUTHOR`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      authorId = maxAuthorIdResult.rows[0].NEXT_ID;
      await connection.execute(
        `INSERT INTO AUTHOR (AUTHOR_ID, AUTHOR_NAME) VALUES (:authorId, :AUTHOR_NAME)`,
        { authorId, AUTHOR_NAME },
        { autoCommit: true }
      );
    }

    const categoryResult = await connection.execute(
      `SELECT CATEGORY_ID FROM CATEGORY WHERE CATEGORY_NAME = :CATEGORY`,
      [CATEGORY],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (categoryResult.rows.length > 0) {
      categoryId = categoryResult.rows[0].CATEGORY_ID;
    } else {
      const maxCategoryIdResult = await connection.execute(`SELECT NVL(MAX(CATEGORY_ID), 0) + 1 AS NEXT_ID FROM CATEGORY`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      categoryId = maxCategoryIdResult.rows[0].NEXT_ID;
      await connection.execute(
        `INSERT INTO CATEGORY (CATEGORY_ID, CATEGORY_NAME) VALUES (:categoryId, :CATEGORY)`,
        { categoryId, CATEGORY },
        { autoCommit: true }
      );
    }

    await connection.execute(
      `INSERT INTO BOOKS (ISBN, TITLE, EDITION, PUBLISHER_ID, PUBLICATION_DATE, PRICE, STOCK, DISCOUNT,STATUS) 
       VALUES (:ISBN, :TITLE, :EDITION, :publisherId, TO_DATE(:PUBLICATION_DATE, 'YYYY-MM-DD'), :PRICE, :STOCK, :DISCOUNT, :status)`,
      { ISBN, TITLE, EDITION, publisherId, PUBLICATION_DATE, PRICE, STOCK, DISCOUNT, status },
      { autoCommit: true }
    );

    await connection.execute(
      `INSERT INTO BOOKS_AUTHOR (ISBN, AUTHOR_ID) VALUES (:ISBN, :authorId)`,
      { ISBN, authorId },
      { autoCommit: true }
    );

    await connection.execute(
      `INSERT INTO BOOKS_CATEGORY (ISBN, CATEGORY_ID) VALUES (:ISBN, :categoryId)`,
      { ISBN, categoryId },
      { autoCommit: true }
    );

    console.log('New book added successfully.');
  } catch (err) {
    console.error('Error in adding new book:', err);
    throw err; 
  }
}


async function deleteBook(isbn) {
  try {
    const result = await connection.execute(
      `DELETE FROM BOOKS WHERE ISBN = :isbn`,
      [isbn],
      { autoCommit: true }
    );
    if (result.rowsAffected === 0) {
      console.log('No book found with the specified ISBN:', isbn);
      return { success: false, message: 'No book found with the specified ISBN' };
    } else {
      console.log('Book deleted successfully:', isbn);
      return { success: true, message: 'Book deleted successfully' };
    }
  } catch (err) {
    console.error('Error deleting book:', err);
    throw err;
  }
}

async function updateEdition(isbn, edition) {
  try {
    await connection.execute(
      `UPDATE BOOKS SET EDITION = :edition WHERE ISBN = :isbn`,
      { edition, isbn },
      { autoCommit: true }
    );
    console.log('Edition updated successfully for ISBN:', isbn);
  } catch (err) {
    console.error('Error updating edition:', err);
    throw err;
  }
}

async function updatePrice(isbn, price) {
  try {
    await connection.execute(
      `UPDATE BOOKS SET PRICE = :price WHERE ISBN = :isbn`,
      { price, isbn },
      { autoCommit: true }
    );
    console.log('Price updated successfully for ISBN:', isbn);
  } catch (err) {
    console.error('Error updating price:', err);
    throw err;
  }
}

async function updateStock(isbn, stock) {
  try {
    await connection.execute(
      `UPDATE BOOKS SET STOCK = :stock WHERE ISBN = :isbn`,
      { stock, isbn },
      { autoCommit: true }
    );
    console.log('Stock updated successfully for ISBN:', isbn);
  } catch (err) {
    console.error('Error updating stock:', err);
    throw err;
  }
}

async function updateDiscount(isbn, discount) {
  try {
    await connection.execute(
      `UPDATE BOOKS SET DISCOUNT = :discount WHERE ISBN = :isbn`,
      { discount, isbn },
      { autoCommit: true }
    );
    console.log('Discount updated successfully for ISBN:', isbn);
  } catch (err) {
    console.error('Error updating discount:', err);
    throw err;
  }
}


async function TotalOrder(startDate, endDate) {
  try {
    const result = await connection.execute(
      `BEGIN :ret := CALCULATE_TOTAL_ORDER(:startDate, :endDate); END;`,
      {
        ret: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        startDate: startDate,
        endDate: endDate
      }
    );

    console.log(`Total orders from ${startDate} to ${endDate}:`, result.outBinds.ret);
    return result.outBinds.ret; 
  } catch (err) {
    console.error('Error in totalOrder function:', err);
    throw err;
  }
}



async function TotalSales(startDate, endDate) {
  try {
    const result = await connection.execute(
      `BEGIN :ret := CALCULATE_TOTAL_BOOKS_SOLD(:startDate, :endDate); END;`,
      {
        ret: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        startDate: startDate,
        endDate: endDate
      }
    );

    console.log(`Total books sold from ${startDate} to ${endDate}:`, result.outBinds.ret);
    return result.outBinds.ret; 
  } catch (err) {
    console.error('Error in TotalSales function:', err);
    throw err;
  }
}


async function TotalRevenue(startDate, endDate) {
  try {
    const result = await connection.execute(
      `BEGIN :ret := CALCULATE_TOTAL_REVENUE(:startDate, :endDate); END;`,
      {
        ret: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        startDate: startDate,
        endDate: endDate
      }
    );

    console.log(`Total revenue from ${startDate} to ${endDate}:`, result.outBinds.ret);
    return result.outBinds.ret; 
  } catch (err) {
    console.error('Error in TotalRevenue function:', err);
    throw err;
  }
}



async function removeUser(userId) {
  try {
    await connection.execute(
      `DELETE FROM users WHERE user_id = :userId`,
      [userId],
      { autoCommit: true }
    );
    console.log('User removed successfully.');
  } catch (err) {
    console.error('Error removing user:', err);
    throw err; 
  }
}


async function averageRating(isbn) {
  try {
    const result = await connection.execute(
      `BEGIN :ret := CALCULATE_AVERAGE_RATING(:isbn); END;`,
      {
        ret: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        isbn: isbn
      }
    );
    console.log('Average rating:', result.outBinds.ret);
    return result.outBinds.ret; 
  } catch (err) {
    console.error('Error calculating average rating:', err);
    throw err;
  } 
}



async function IncreaseDiscountAll(increaseAmount) {
  try {
    await connection.execute(
      `BEGIN INCREASE_ALL_BOOKS_DISCOUNT(:increaseAmount); END;`,
      { increaseAmount: increaseAmount },
      { autoCommit: true }
    );
    console.log(`Discount increased by ${increaseAmount}% for all books.`);
  } catch (err) {
    console.error('Error increasing discount for all books:', err);
    throw err;
  }
}



async function DecreaseDiscountAll(decreaseAmount) {
  try {
    await connection.execute(
      `BEGIN DECREASE_ALL_BOOKS_DISCOUNT(:decreaseAmount); END;`,
      { decreaseAmount: decreaseAmount },
      { autoCommit: true }
    );
    console.log(`Discount decreased by ${decreaseAmount}% for all books.`);
  } catch (err) {
    console.error('Error decreasing discount for all books:', err);
    throw err;
  }
}


async function editProfile(userId, email, password, street, city, country) {
  try {
    const emailCheckResult = await connection.execute(
      `SELECT COUNT(*) AS count FROM users WHERE email = :email AND user_id != :userId`,
      { email, userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (emailCheckResult.rows[0].COUNT > 0) {
      return { success: false, message: 'Another user already uses this email.' };
    }

    const passwordCheckResult = await connection.execute(
      `SELECT COUNT(*) AS count FROM users WHERE password = :password AND user_id != :userId`,
      { password, userId },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    if (passwordCheckResult.rows[0].COUNT > 0) {
      return { success: false, message: 'Password is already in use by another user.' };
    }

    await connection.execute(
      `UPDATE users SET email = :email, password = :password, street = :street, city = :city, country = :country WHERE user_id = :userId`,
      { email, password, street, city, country, userId },
      { autoCommit: true }
    );

    return { success: true, message: 'Profile updated successfully.' };
  } catch (err) {
    console.error('Error updating user profile:', err);
    throw err; 
  }
}




async function RequestForBooks(userId, bookTitle) {
  try {
    const idResult = await connection.execute(
      `SELECT NVL(MAX(REQUEST_ID), 0) + 1 AS NEXT_ID FROM BOOK_REQUESTS`,
      [],
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );

    const nextId = idResult.rows[0].NEXT_ID;

    await connection.execute(
      `INSERT INTO BOOK_REQUESTS (REQUEST_ID, USER_ID, BOOK_TITLE)
       VALUES (:nextId, :userId, :bookTitle)`,
      { nextId, userId, bookTitle },
      { autoCommit: true }
    );

    console.log('Book request inserted successfully with REQUEST_ID:', nextId);
  } catch (err) {
    console.error('Error inserting book request:', err);
    throw err;
  }
}









    module.exports = {
      initializeDB,
      closeDB,
      insertUser,
      authenticateUser,
      insertBooks,
      insertAuthorDetails,
      getUserDetails,
      addToCart,
      getBookStock,
      getTotalPrice,
      placeOrder,
      removeFromCart,
      insertReview,
      addNewBook,
      removeUser,
      deleteBook,
      updateEdition,
      updatePrice,
      updateStock,
      updateDiscount,
      averageRating,
      TotalOrder,
      TotalSales,
      TotalRevenue,
      IncreaseDiscountAll,
      DecreaseDiscountAll,
      editProfile,
      updateLastLoginTime,
      deleteProfileRequest,
      RequestForBooks
    };      



