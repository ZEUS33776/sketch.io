const getLeaderboard = async () => {
  try {
    const response = await fetch('https://jsonplaceholder.typicode.com/users');
    // Check if the response is ok (status in the range 200-299)
    if (!response.ok) {
      throw new Error('Network response was not ok');
    }
    const data = await response.json();
    return data; // Now the function returns the data
  } catch (error) {
    console.error('There was a problem with the fetch operation:', error);
    return []; // Return an empty array or handle the error as needed
  }
};

export {getLeaderboard};
export default getLeaderboard;