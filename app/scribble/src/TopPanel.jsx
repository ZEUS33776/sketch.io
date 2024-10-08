const TopPanel = () => {
  const length = 6;
  return (
    <div>
      <div className=" flex gap-1 items-center justify-center">
        {[...Array(length)].map((_, index) => (
          <div
            key={index}
            className="border-b-4 border-black w-[20px]  text-black font-bold text-2xl flex justify-center"
          >
            A
          </div>
        ))}
      </div>
    </div>
  );
};

export default TopPanel;
