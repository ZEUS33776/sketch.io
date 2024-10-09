import { TargetContext } from '../pages/MainCanvasPage';
import { useContext } from 'react';
const TopPanel = () => {
  const { word,isCorrectGuess } = useContext(TargetContext);
  const length = word.length;
  return (
    <div className='h-8'>
      <div className=" flex  gap-1 mb-2 items-center justify-center">
        {[...Array(length)].map((_, index) => (
          <div
            key={index}
            className="border-b-4 border-black w-[20px]  text-black font-bold text-2xl flex justify-center"
          >
            {
             isCorrectGuess? word[index]:""}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopPanel;
