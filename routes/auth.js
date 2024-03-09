const $ = require('jquery');
const oracledb = require('oracledb');
const dbConfig = {
  user: "C##BOOKSTORE",
  password: "bookstore",
  connectString: "localhost:1521/orcl"
};
async function getAllBooks() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute("SELECT* FROM BOOKS");
        
        return result.rows;
    } catch (error) {
        console.error('Error fetching books:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}

async function searchBooks(searchParams) {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);

        let sql = `
        SELECT b.ISBN, b.TITLE, b.EDITION, b.PUBLICATION_DATE, b.PRICE, b.STATUS, b.STOCK, b.DISCOUNT
        FROM BOOKS b
        WHERE 1=1`;
        
        const params = {};

        if (searchParams.name) {
            sql +=  `AND LOWER(b.TITLE) LIKE LOWER(:name)`;
            params.name = `%${searchParams.name}%`;
        }

        if (searchParams.author) {
            sql += `
            AND b.ISBN IN (
                SELECT ba.ISBN
                FROM BOOKS_AUTHOR ba
                WHERE ba.AUTHOR_ID IN (
                    SELECT a.AUTHOR_ID
                    FROM AUTHOR a
                    WHERE LOWER(a.AUTHOR_NAME) LIKE LOWER(:authorName)
                )
            )`;
            params.authorName = `%${searchParams.author}%`;
        }

        if (searchParams.category) {
            sql += `
            AND b.ISBN IN (
                SELECT bc.ISBN
                FROM BOOKS_CATEGORY bc
                WHERE bc.CATEGORY_ID IN (
                    SELECT c.CATEGORY_ID
                    FROM CATEGORY c
                    WHERE LOWER(c.CATEGORY_NAME) LIKE LOWER(:categoryName)
                )
            )`;
            params.categoryName = `%${searchParams.category}%`;
        }


        if (searchParams.publisher) {
            sql += `
            AND b.PUBLISHER_ID IN (
                SELECT p.PUBLISHER_ID
                FROM PUBLISHER p
                WHERE LOWER(p.NAME) LIKE LOWER(:publisherName)
            )`;
            params.publisherName = `%${searchParams.publisher}%`;
        }

        if (!isNaN(searchParams.lowPrice)) {
            sql +=  ` AND b.PRICE >= :lowPrice`;
            params.lowPrice = parseFloat(searchParams.lowPrice);
        }

        if (!isNaN(searchParams.highPrice)) {
            sql +=  ` AND b.PRICE <= :highPrice`;
            params.highPrice = parseFloat(searchParams.highPrice);
        }


        console.log(sql); 
        console.log(params); 

        const result = await connection.execute(sql, params, { outFormat: oracledb.OUT_FORMAT_OBJECT });
        return result.rows;
    } catch (error) {
        console.error('Error during integrated book search:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


async function fetchBookDetails(isbn) {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const query = `
            SELECT
                B.ISBN,
                B.TITLE AS BOOK_NAME,
                B.EDITION,
                B.PRICE,
                B.STATUS,
                B.STOCK,
                B.DISCOUNT,
                B.PHOTO,
                R.AUTHOR_NAME,
                P.NAME AS PUBLISHER_NAME,
                Q.CATEGORY_NAME
            FROM
                BOOKS B
            JOIN
                (SELECT
                    BA.ISBN AS ISBN,
                    LISTAGG(AUTHOR_NAME, ', ') WITHIN GROUP (ORDER BY A.AUTHOR_ID) AS AUTHOR_NAME
                FROM
                    BOOKS_AUTHOR BA
                JOIN
                    AUTHOR A ON BA.AUTHOR_ID = A.AUTHOR_ID
                GROUP BY
                    BA.ISBN
                ) R ON B.ISBN = R.ISBN
            JOIN
                (SELECT
                    BC.ISBN AS ISBN,
                    LISTAGG(CATEGORY_NAME, ', ') WITHIN GROUP (ORDER BY C.CATEGORY_ID) AS CATEGORY_NAME
                FROM
                    BOOKS_CATEGORY BC
                JOIN
                    CATEGORY C ON BC.CATEGORY_ID = C.CATEGORY_ID
                GROUP BY
                    BC.ISBN
                ) Q ON B.ISBN = Q.ISBN
            JOIN
                PUBLISHER P ON B.PUBLISHER_ID = P.PUBLISHER_ID
            WHERE
                B.ISBN = :isbn`;
        const result = await connection.execute(query, { isbn });
        console.log('Database response:', result.rows[0]); 
        return result.rows[0];
    } catch (error) {
        console.error('Error fetching book details:', error);
        throw new Error('Error fetching book details');
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}




async function fetchCartItems(userId) {
    let connection;

    try {
        connection = await oracledb.getConnection(dbConfig);
        const query = `
            SELECT ci.ISBN, ci.BOOK_COUNT
            FROM CART c
            JOIN IN_CART_ITEMS ci ON c.CART_ID = ci.CART_ID
            WHERE c.USER_ID = :userId
        `;
        const result = await connection.execute(query, [userId]);
        return result.rows;
    } 
    catch (error) {
        console.error('Error fetching cart items:', error);
        throw error;
    } 
}

async function fetchCartItems(userId) {
    let connection;

    try {
        connection = await oracledb.getConnection(dbConfig);
        const query = `
            SELECT ci.ISBN, ci.BOOK_COUNT
            FROM CART c
            JOIN IN_CART_ITEMS ci ON c.CART_ID = ci.CART_ID
            WHERE c.USER_ID = :userId
        `;
        const result = await connection.execute(query, [userId]);
        return result.rows;
    } 
    catch (error) {
        console.error('Error fetching cart items:', error);
        throw error;
    } 
}

async function getAllUsers() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute("SELECT* FROM USERS");   
        return result.rows;
    } catch (error) {
        console.error('Error fetching users:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


async function getAllReviews() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const query = `
            SELECT
                users.email AS user_email,
                books.title AS book_name,
                customer_review.rating,
                customer_review.review_text,
                customer_review.date_posted
            FROM
                customer_review
                JOIN users ON customer_review.user_id = users.user_id
                JOIN books ON customer_review.ISBN = books.ISBN
        `;
        const result = await connection.execute(query);
        return result.rows;
    } catch (error) {
        console.error('Error fetching reviews:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}


async function getAllRequestedBooks() {
    let connection;
    try {
        connection = await oracledb.getConnection(dbConfig);
        const result = await connection.execute("SELECT USER_ID, BOOK_TITLE FROM BOOK_REQUESTS");
        
        return result.rows;
    } catch (error) {
        console.error('Error fetching books:', error);
        throw error;
    } finally {
        if (connection) {
            await connection.close();
        }
    }
}






module.exports = {
    getAllBooks,
    searchBooks,
    fetchCartItems,
    getAllUsers,
    getAllReviews,
    fetchBookDetails,
    getAllRequestedBooks
};
