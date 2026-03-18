UPDATE auth.users
SET encrypted_password = crypt('newpassword', gen_salt('bf'))
WHERE id = '8bf6e69d-e794-4ddb-8f45-3c61354b3fd5';