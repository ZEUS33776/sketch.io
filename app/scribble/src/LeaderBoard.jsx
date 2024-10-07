import React, { useState, useEffect } from 'react';
const LeaderBoard = () => {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    fetch('https://jsonplaceholder.typicode.com/users')
      .then((response) => response.json())
      .then((data) => setUsers(data));
  }, []);
  return (
    <div className="bg-white rounded-md p-5 h-full">
      <h1 className="text-3xl font-semibold font-heading">Leader Board </h1>
      <ul>
        {users.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </div>
  );
};

export default LeaderBoard;
