import React, { useState, useEffect } from 'react';
import wizard from '../public/assets/wizard.png';
import { getLeaderboard } from '../services/leaderBoardServices';
const LeaderBoard = () => {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const data = await getLeaderboard();
        setUsers(data);
      } catch (error) {
        console.error('Error fetching leaderboard:', error);
      }
    };

    fetchUsers();
  }, []);
  return (
    <div className="p-2 h-full">
      <h1 className="text-3xl  font-semibold font-heading text-custom-blue flex justify-center">
        Leader Board{' '}
      </h1>
      <ul>
        {users.map((user, index) => (
          <div
            className="flex gap-4 p-2 items-center font-semibold justify-start"
            key={index}
          >
            <span>#{index + 1}</span>
            <img src={wizard} alt="wizard" className="w-10 h-10" />
            <div className="flex gap-2 justify-between w-full">
              <div>{user.name.split(' ')[0]}</div>
              <span>100</span>
            </div>
          </div>
        ))}
      </ul>
    </div>
  );
};

export default LeaderBoard;
